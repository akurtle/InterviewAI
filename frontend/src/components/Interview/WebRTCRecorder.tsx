import React, { useEffect, useRef, useState } from "react";
import {
  fetchWithLoopbackFallback,
  getApiBase,
  getWsBase,
  openWebSocketWithLoopbackFallback,
} from "../../network";
import type { SessionType } from "../../hooks/useSessionType";
import {
  CALL_ENVIRONMENT_PRESETS,
  type CallEnvironmentId,
} from "./callEnvironments";
import type { SessionRecording } from "./types";

type RecordMode = "audio" | "video" | "both";
type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

type DetectedFace = {
  boundingBox?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
};

type FaceDetectorLike = {
  detect: (input: CanvasImageSource) => Promise<DetectedFace[]>;
};

type IceCandidatePayload = {
  candidate: string | null;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  usernameFragment?: string | null;
};

type WebRTCConfig = {
  ice_servers?: RTCIceServer[];
  results_ws_heartbeat_seconds?: number;
  session_ttl_seconds?: number;
};

type SignalAnswer = {
  sdp: string;
  type: RTCSdpType;
  session_id: string;
};

type SessionEventMessage = {
  type: "session_event";
  event?: string;
  value?: string;
  session_id?: string;
  timestamp?: string;
};

type RemoteIceCandidateMessage = IceCandidatePayload & {
  type: "ice_candidate";
  session_id?: string;
  timestamp?: string;
};

type RecorderMessage = {
  type?: string;
  text?: string;
  [key: string]: unknown;
};

type Props = {
  mode?: RecordMode;
  sessionType?: SessionType;
  callEnvironment?: CallEnvironmentId;
  mouthTrackingEnabled?: boolean;
  selectedAudioInputId?: string;
  selectedVideoInputId?: string;
  onPreferredDevicesUnavailable?: (kinds: Array<"audioinput" | "videoinput">) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onVisionData?: (data: unknown) => void;
  onRecordingReady?: (recording: SessionRecording | null) => void;
  onStreamReady?: (stream: MediaStream | null) => void;
  onStartupMetric?: (
    metric:
      | "media_stream_ready_ms"
      | "offer_created_ms"
      | "ice_gathering_complete_ms"
      | "results_socket_ready_ms"
      | "signaling_response_ms"
      | "remote_description_ready_ms"
      | "ice_connected_ms"
      | "webrtc_connected_ms"
  ) => void;
};

declare global {
  interface Window {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorLike;
  }
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];
const DEFAULT_RESULTS_HEARTBEAT_SECONDS = 20;
const RESULTS_RECONNECT_DELAYS_MS = [1000, 2000, 5000];
const LOCAL_ICE_BATCH_DELAY_MS = 75;

const isRecoverableDeviceSelectionError = (error: unknown) =>
  error instanceof DOMException &&
  (error.name === "NotFoundError" || error.name === "OverconstrainedError");

const buildMediaConstraints = ({
  mode,
  selectedAudioInputId,
  selectedVideoInputId,
  usePreferredDeviceIds,
}: {
  mode: RecordMode;
  selectedAudioInputId?: string;
  selectedVideoInputId?: string;
  usePreferredDeviceIds: boolean;
}): MediaStreamConstraints => ({
  audio:
    mode === "audio" || mode === "both"
      ? selectedAudioInputId && usePreferredDeviceIds
        ? { deviceId: { exact: selectedAudioInputId } }
        : true
      : false,
  video:
    mode === "video" || mode === "both"
      ? {
          ...(selectedVideoInputId && usePreferredDeviceIds
            ? { deviceId: { exact: selectedVideoInputId } }
            : {}),
          width: { ideal: 1280 },
          height: { ideal: 720 },
        }
      : false,
});

const observeIceGatheringComplete = (
  pc: RTCPeerConnection,
  onComplete: () => void
) => {
  if (pc.iceGatheringState === "complete") {
    onComplete();
    return () => {};
  }

  let isDone = false;
  const handleChange = () => {
    if (isDone || pc.iceGatheringState !== "complete") {
      return;
    }

    isDone = true;
    pc.removeEventListener("icegatheringstatechange", handleChange);
    onComplete();
  };

  pc.addEventListener("icegatheringstatechange", handleChange);
  return () => {
    isDone = true;
    pc.removeEventListener("icegatheringstatechange", handleChange);
  };
};

const WebRTCRecorder: React.FC<Props> = ({
  mode = "both",
  sessionType = "interview",
  callEnvironment = "teams",
  mouthTrackingEnabled = true,
  selectedAudioInputId,
  selectedVideoInputId,
  onPreferredDevicesUnavailable,
  onStatusChange,
  onTranscript,
  onVisionData,
  onRecordingReady,
  onStreamReady,
  onStartupMetric,
}) => {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const stageShellRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const resultsHeartbeatRef = useRef<number | null>(null);
  const resultsReconnectTimerRef = useRef<number | null>(null);
  const resultsReconnectAttemptsRef = useRef(0);
  const sessionActiveRef = useRef(false);
  const configRef = useRef<WebRTCConfig | null>(null);
  const pendingIceCandidatesRef = useRef<IceCandidatePayload[]>([]);
  const pendingRemoteIceCandidatesRef = useRef<IceCandidatePayload[]>([]);
  const pendingIceFlushTimerRef = useRef<number | null>(null);
  const iceGatheringCleanupRef = useRef<(() => void) | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const visionIntervalRef = useRef<number | null>(null);
  const visionBusyRef = useRef(false);
  const visionEnabledRef = useRef(false);
  const faceDetectorRef = useRef<FaceDetectorLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingMimeTypeRef = useRef<string>("");
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingStopPromiseRef = useRef<Promise<void> | null>(null);
  const recordingStopResolverRef = useRef<(() => void) | null>(null);
  const isStoppingRef = useRef(false);
  const clockStartedAtRef = useRef<number | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [messages, setMessages] = useState<RecorderMessage[]>([]);
  const [connectionDetails, setConnectionDetails] = useState<{
    signaling: string;
    ice: string;
    peer: string;
    resultsSocket: string;
  }>({
    signaling: "idle",
    ice: "new",
    peer: "new",
    resultsSocket: "idle",
  });
  const apiBase = getApiBase();
  const wsBase = getWsBase();
  const environment = CALL_ENVIRONMENT_PRESETS[callEnvironment];
  const elapsedLabel = formatCallClock(elapsedMs);
  const supportsFullscreen =
    typeof document !== "undefined" &&
    typeof document.fullscreenEnabled === "boolean" &&
    document.fullscreenEnabled;

  const updateStatus = (newStatus: ConnectionStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  };

  const updateConnectionDetails = (
    patch: Partial<{
      signaling: string;
      ice: string;
      peer: string;
      resultsSocket: string;
    }>
  ) => {
    setConnectionDetails((prev) => ({ ...prev, ...patch }));
  };

  const pickRecordingMimeType = () => {
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=h264,opus",
      "video/webm",
    ];

    for (const candidate of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    }

    return "";
  };

  const startLocalRecording = (stream: MediaStream) => {
    if (typeof MediaRecorder === "undefined") {
      onRecordingReady?.(null);
      return;
    }

    if (stream.getVideoTracks().length === 0) {
      onRecordingReady?.(null);
      return;
    }

    const mimeType = pickRecordingMimeType();

    try {
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];
      recordingMimeTypeRef.current = recorder.mimeType || mimeType || "video/webm";
      recordingStartedAtRef.current = Date.now();
      recordingStopPromiseRef.current = null;
      recordingStopResolverRef.current = null;

      recorder.ondataavailable = (event) => {
        if (!event.data || event.data.size === 0) return;
        recordingChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, {
          type: recordingMimeTypeRef.current || "video/webm",
        });
        const startedAt = recordingStartedAtRef.current;
        const durationSeconds =
          startedAt == null ? null : Math.max(1, Math.round((Date.now() - startedAt) / 1000));

        if (blob.size > 0) {
          onRecordingReady?.({
            blob,
            mimeType: blob.type || recordingMimeTypeRef.current || "video/webm",
            size: blob.size,
            durationSeconds,
          });
        } else {
          onRecordingReady?.(null);
        }

        mediaRecorderRef.current = null;
        recordingChunksRef.current = [];
        recordingMimeTypeRef.current = "";
        recordingStartedAtRef.current = null;
        recordingStopResolverRef.current?.();
        recordingStopResolverRef.current = null;
        recordingStopPromiseRef.current = null;
      };

      recorder.onerror = (event) => {
        console.error("Local recording error:", event);
      };

      recorder.start(1000);
    } catch (recordingError) {
      console.error("Failed to start local recording:", recordingError);
      onRecordingReady?.(null);
    }
  };

  const stopLocalRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return;
    }

    if (!recordingStopPromiseRef.current) {
      recordingStopPromiseRef.current = new Promise<void>((resolve) => {
        recordingStopResolverRef.current = resolve;
      });
    }

    try {
      recorder.stop();
    } catch (recordingError) {
      console.error("Failed to stop local recording:", recordingError);
      recordingStopResolverRef.current?.();
      recordingStopResolverRef.current = null;
      recordingStopPromiseRef.current = null;
    }

    await recordingStopPromiseRef.current;
  };

  const getFaceDetector = () => {
    if (faceDetectorRef.current) {
      return faceDetectorRef.current;
    }

    const FaceDetectorCtor = window.FaceDetector;
    if (!FaceDetectorCtor) {
      return null;
    }

    faceDetectorRef.current = new FaceDetectorCtor({
      fastMode: true,
      maxDetectedFaces: 1,
    });
    return faceDetectorRef.current;
  };

  const clearResultsSocketTimers = () => {
    if (resultsHeartbeatRef.current) {
      window.clearInterval(resultsHeartbeatRef.current);
      resultsHeartbeatRef.current = null;
    }
    if (resultsReconnectTimerRef.current) {
      window.clearTimeout(resultsReconnectTimerRef.current);
      resultsReconnectTimerRef.current = null;
    }
  };

  const reportResultsSocketFailure = (socketError: unknown) => {
    console.error("Results WebSocket error:", socketError);
    updateConnectionDetails({ resultsSocket: "error" });
    setError(socketError instanceof Error ? socketError.message : "Results WebSocket connection failed");
  };

  const clearPendingIceFlushTimer = () => {
    if (pendingIceFlushTimerRef.current) {
      window.clearTimeout(pendingIceFlushTimerRef.current);
      pendingIceFlushTimerRef.current = null;
    }
  };

  const loadWebRtcConfig = async () => {
    if (configRef.current) {
      return configRef.current;
    }

    try {
      const response = await fetchWithLoopbackFallback(`${apiBase}/webrtc/config`);
      if (!response.ok) {
        throw new Error(`Failed to load WebRTC config (${response.status})`);
      }

      const config = (await response.json()) as WebRTCConfig;
      configRef.current = config;
      return config;
    } catch (configError) {
      console.warn("Falling back to built-in ICE server config:", configError);
      const fallbackConfig: WebRTCConfig = {
        ice_servers: DEFAULT_ICE_SERVERS,
        results_ws_heartbeat_seconds: DEFAULT_RESULTS_HEARTBEAT_SECONDS,
      };
      configRef.current = fallbackConfig;
      return fallbackConfig;
    }
  };

  const postIceCandidates = async (sid: string, candidates: IceCandidatePayload[]) => {
    const response = await fetchWithLoopbackFallback(`${apiBase}/webrtc/candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sid,
        candidates: candidates.map((candidate) => ({
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
          usernameFragment: candidate.usernameFragment ?? null,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send ICE candidates (${response.status})`);
    }
  };

  const flushPendingIceCandidates = async (sid: string) => {
    clearPendingIceFlushTimer();
    const pending = [...pendingIceCandidatesRef.current];
    if (!pending.length) {
      return;
    }
    pendingIceCandidatesRef.current = [];

    try {
      await postIceCandidates(sid, pending);
    } catch (candidateError) {
      console.error("Failed to send pending ICE candidates:", candidateError);
      pendingIceCandidatesRef.current = [...pending, ...pendingIceCandidatesRef.current];
      throw candidateError;
    }
  };

  const schedulePendingIceFlush = (sid: string) => {
    if (pendingIceFlushTimerRef.current) {
      return;
    }

    pendingIceFlushTimerRef.current = window.setTimeout(() => {
      pendingIceFlushTimerRef.current = null;
      void flushPendingIceCandidates(sid).catch(() => {});
    }, LOCAL_ICE_BATCH_DELAY_MS);
  };

  const queueIceCandidate = (sid: string, payload: IceCandidatePayload) => {
    pendingIceCandidatesRef.current.push(payload);
    if (payload.candidate === null) {
      void flushPendingIceCandidates(sid).catch(() => {});
      return;
    }

    schedulePendingIceFlush(sid);
  };

  const applyRemoteIceCandidate = async (payload: IceCandidatePayload) => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) {
      pendingRemoteIceCandidatesRef.current.push(payload);
      return;
    }

    if (payload.candidate === null) {
      await pc.addIceCandidate(null);
      return;
    }

    await pc.addIceCandidate(
      new RTCIceCandidate({
        candidate: payload.candidate,
        sdpMid: payload.sdpMid,
        sdpMLineIndex: payload.sdpMLineIndex,
        usernameFragment: payload.usernameFragment ?? undefined,
      })
    );
  };

  const flushPendingRemoteIceCandidates = async () => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription || !pendingRemoteIceCandidatesRef.current.length) {
      return;
    }

    const pending = [...pendingRemoteIceCandidatesRef.current];
    pendingRemoteIceCandidatesRef.current = [];

    for (const candidate of pending) {
      try {
        await applyRemoteIceCandidate(candidate);
      } catch (candidateError) {
        console.error("Failed to apply remote ICE candidate:", candidateError);
      }
    }
  };

  const connectResultsWebSocket = async (sid: string) => {
    const ws = await openWebSocketWithLoopbackFallback(`${wsBase}/ws/results/${sid}`);
    wsRef.current = ws;
    resultsReconnectAttemptsRef.current = 0;
    updateConnectionDetails({ resultsSocket: "connected" });
    onStartupMetric?.("results_socket_ready_ms");

    const heartbeatSeconds =
      configRef.current?.results_ws_heartbeat_seconds ?? DEFAULT_RESULTS_HEARTBEAT_SECONDS;
    clearResultsSocketTimers();
    resultsHeartbeatRef.current = window.setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        return;
      }

      ws.send(JSON.stringify({ type: "ping", session_id: sid, timestamp: Date.now() }));
    }, Math.max(5, heartbeatSeconds) * 1000);

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data) as RecorderMessage;
        setMessages((prev) => [...prev.slice(-11), msg]);

        if (msg.type === "transcript" || msg.type === "asr") {
          const text = typeof msg.text === "string" ? msg.text : "";
          if (text) {
            onTranscript?.(text, true);
          }
          return;
        }

        if (msg.type === "vision" || msg.type === "vision_status") {
          onVisionData?.(msg);
          return;
        }

        if (msg.type === "ice_candidate") {
          await applyRemoteIceCandidate(msg as RemoteIceCandidateMessage);
          return;
        }

        if (msg.type === "session_event") {
          const sessionEvent = msg as SessionEventMessage;
          if (sessionEvent.event === "connection_state" && typeof sessionEvent.value === "string") {
            updateConnectionDetails({ peer: sessionEvent.value });
          }
          if (sessionEvent.event === "ice_connection_state" && typeof sessionEvent.value === "string") {
            updateConnectionDetails({ ice: sessionEvent.value });
          }
          if (sessionEvent.event === "results_socket" && typeof sessionEvent.value === "string") {
            updateConnectionDetails({ resultsSocket: sessionEvent.value });
          }
          return;
        }

        if (msg.type === "pong") {
          updateConnectionDetails({ resultsSocket: "healthy" });
        }
      } catch (parseError) {
        console.error("Failed to parse WebSocket message:", parseError);
      }
    };

    ws.onerror = () => {
      if (!sessionActiveRef.current) {
        return;
      }
      updateConnectionDetails({ resultsSocket: "error" });
    };

    ws.onclose = () => {
      clearResultsSocketTimers();
      wsRef.current = null;
      updateConnectionDetails({ resultsSocket: "closed" });

      if (!sessionActiveRef.current || isStoppingRef.current) {
        return;
      }

      const attempt = resultsReconnectAttemptsRef.current;
      const delay =
        RESULTS_RECONNECT_DELAYS_MS[Math.min(attempt, RESULTS_RECONNECT_DELAYS_MS.length - 1)];
      resultsReconnectAttemptsRef.current += 1;
      resultsReconnectTimerRef.current = window.setTimeout(() => {
        void connectResultsWebSocket(sid).catch((socketError: unknown) => {
          console.error("Results WebSocket reconnect failed:", socketError);
          setError(socketError instanceof Error ? socketError.message : "Results WebSocket reconnect failed");
          updateStatus("error");
        });
      }, delay);
    };
  };

  const startVisionSampling = () => {
    if (!videoRef.current || (mode !== "video" && mode !== "both")) {
      return;
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const detector = getFaceDetector();
    if (!detector) {
      onVisionData?.({
        type: "vision_status",
        source: "client",
        message: "Browser face detection is unavailable. Video feedback metrics were not captured.",
      });
      visionEnabledRef.current = false;
      return;
    }

    visionEnabledRef.current = true;
    if (visionIntervalRef.current) {
      window.clearInterval(visionIntervalRef.current);
    }

    // Keep client-side vision sampling lightweight so signaling stays responsive.
    visionIntervalRef.current = window.setInterval(async () => {
      if (visionBusyRef.current || !visionEnabledRef.current) return;
      visionBusyRef.current = true;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        visionBusyRef.current = false;
        return;
      }

      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) {
        visionBusyRef.current = false;
        return;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        visionBusyRef.current = false;
        return;
      }

      ctx.drawImage(video, 0, 0, width, height);

      try {
        const faces = await detector.detect(canvas);
        const primaryFace = faces[0]?.boundingBox;
        const facePresent = Boolean(primaryFace);

        let headYaw: number | null = null;
        let headPitch: number | null = null;
        let lookingAtCamera = false;

        if (primaryFace) {
          const faceCenterX = ((primaryFace.x ?? 0) + (primaryFace.width ?? 0) / 2) / width;
          const faceCenterY = ((primaryFace.y ?? 0) + (primaryFace.height ?? 0) / 2) / height;
          const horizontalOffset = faceCenterX - 0.5;
          const verticalOffset = faceCenterY - 0.5;

          headYaw = Math.max(-30, Math.min(30, horizontalOffset * 120));
          headPitch = Math.max(-20, Math.min(20, verticalOffset * 90));
          lookingAtCamera = Math.abs(horizontalOffset) <= 0.1 && Math.abs(verticalOffset) <= 0.12;
        }

        onVisionData?.({
          type: "frame",
          frame: {
            timestamp: Date.now() / 1000,
            face_present: facePresent,
            looking_at_camera: lookingAtCamera,
            smile_prob: null,
            head_yaw: headYaw,
            head_pitch: headPitch,
          },
          source: "client",
        });
      } catch (visionError) {
        console.error("Vision sampling error:", visionError);
        onVisionData?.({
          type: "vision_status",
          source: "client",
          message: "Vision metric extraction failed for a sampled frame.",
        });
      } finally {
        visionBusyRef.current = false;
      }
    }, 800);
  };

  const startSession = async () => {
    setError(null);
    sessionActiveRef.current = true;
    updateStatus("connecting");
    updateConnectionDetails({
      signaling: "starting",
      ice: "new",
      peer: "new",
      resultsSocket: "connecting",
    });

    try {
      const config = await loadWebRtcConfig();
      const preferredKinds: Array<"audioinput" | "videoinput"> = [];
      if ((mode === "audio" || mode === "both") && selectedAudioInputId) {
        preferredKinds.push("audioinput");
      }
      if ((mode === "video" || mode === "both") && selectedVideoInputId) {
        preferredKinds.push("videoinput");
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(
          buildMediaConstraints({
            mode,
            selectedAudioInputId,
            selectedVideoInputId,
            usePreferredDeviceIds: true,
          })
        );
      } catch (mediaError) {
        if (!preferredKinds.length || !isRecoverableDeviceSelectionError(mediaError)) {
          throw mediaError;
        }

        stream = await navigator.mediaDevices.getUserMedia(
          buildMediaConstraints({
            mode,
            selectedAudioInputId,
            selectedVideoInputId,
            usePreferredDeviceIds: false,
          })
        );
        onPreferredDevicesUnavailable?.(preferredKinds);
      }

      streamRef.current = stream;
      onStreamReady?.(stream);
      onStartupMetric?.("media_stream_ready_ms");

      if (videoRef.current && (mode === "video" || mode === "both")) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => {});
      }

      startLocalRecording(stream);

      const nextSessionId = sessionId ?? crypto.randomUUID();
      setSessionId(nextSessionId);

      const pc = new RTCPeerConnection({
        iceCandidatePoolSize: 4,
        iceServers: config.ice_servers?.length ? config.ice_servers : DEFAULT_ICE_SERVERS,
      });
      pcRef.current = pc;
      iceGatheringCleanupRef.current?.();
      iceGatheringCleanupRef.current = observeIceGatheringComplete(pc, () => {
        onStartupMetric?.("ice_gathering_complete_ms");
        iceGatheringCleanupRef.current = null;
      });

      pc.onconnectionstatechange = () => {
        const peerState = pc.connectionState;
        updateConnectionDetails({ peer: peerState });
        if (peerState === "connected") {
          onStartupMetric?.("webrtc_connected_ms");
          updateStatus("connected");
        } else if (peerState === "failed") {
          updateStatus("error");
          setError("WebRTC peer connection failed");
        } else if (peerState === "disconnected") {
          updateStatus("disconnected");
          setError("WebRTC connection lost");
        }
      };

      pc.oniceconnectionstatechange = () => {
        const iceState = pc.iceConnectionState;
        updateConnectionDetails({ ice: iceState });
        if (iceState === "connected" || iceState === "completed") {
          onStartupMetric?.("ice_connected_ms");
        }
        if (iceState === "failed") {
          setError("ICE negotiation failed. Check TURN/STUN configuration.");
        }
      };

      pc.onicecandidate = (event) => {
        const payload: IceCandidatePayload = event.candidate
          ? {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              usernameFragment:
                "usernameFragment" in event.candidate
                  ? (event.candidate as RTCPeerConnectionIceEvent["candidate"] & {
                      usernameFragment?: string | null;
                    }).usernameFragment ?? null
                  : null,
            }
          : {
              candidate: null,
              sdpMid: null,
              sdpMLineIndex: null,
              usernameFragment: null,
            };

        queueIceCandidate(nextSessionId, payload);
      };

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      updateConnectionDetails({ signaling: "creating_offer" });

      const offer = await pc.createOffer();
      onStartupMetric?.("offer_created_ms");
      await pc.setLocalDescription(offer);
      void connectResultsWebSocket(nextSessionId).catch((socketError: unknown) => {
        reportResultsSocketFailure(socketError);
      });

      const response = await fetchWithLoopbackFallback(`${apiBase}/webrtc/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sdp: pc.localDescription?.sdp,
          type: pc.localDescription?.type,
          session_id: nextSessionId,
          mouth_tracking_enabled: mouthTrackingEnabled,
        }),
      });

      if (!response.ok) {
        throw new Error(`Signaling failed: ${response.status} ${response.statusText}`);
      }

      const answer: SignalAnswer = await response.json();
      onStartupMetric?.("signaling_response_ms");
      setSessionId(answer.session_id);
      updateConnectionDetails({ signaling: "answer_received" });

      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      onStartupMetric?.("remote_description_ready_ms");
      await flushPendingRemoteIceCandidates();
      await flushPendingIceCandidates(answer.session_id);
      updateConnectionDetails({ signaling: "stable" });

      startVisionSampling();
    } catch (sessionError: unknown) {
      console.error("WebRTC setup error:", sessionError);
      setError(sessionError instanceof Error ? sessionError.message : "Failed to start WebRTC session");
      updateStatus("error");
      updateConnectionDetails({ signaling: "error", resultsSocket: "error" });
    }
  };

  const stopSession = async () => {
    if (isStoppingRef.current) {
      return;
    }
    isStoppingRef.current = true;
    sessionActiveRef.current = false;

    clearResultsSocketTimers();
    clearPendingIceFlushTimer();
    await stopLocalRecording();

    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    streamRef.current = null;
    onStreamReady?.(null);

    if (pcRef.current) {
      pcRef.current.getSenders().forEach((sender) => {
        sender.track?.stop();
      });
      pcRef.current.close();
      pcRef.current = null;
    }
    iceGatheringCleanupRef.current?.();
    iceGatheringCleanupRef.current = null;

    wsRef.current?.close();
    wsRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (visionIntervalRef.current) {
      window.clearInterval(visionIntervalRef.current);
      visionIntervalRef.current = null;
    }
    visionEnabledRef.current = false;
    visionBusyRef.current = false;
    pendingIceCandidatesRef.current = [];
    pendingRemoteIceCandidatesRef.current = [];

    updateConnectionDetails({
      signaling: "idle",
      ice: "closed",
      peer: "closed",
      resultsSocket: "closed",
    });
    updateStatus("idle");
    setSessionId(null);
    isStoppingRef.current = false;
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === stageShellRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (status === "connecting" || status === "connected") {
      if (clockStartedAtRef.current === null) {
        clockStartedAtRef.current = Date.now();
        setElapsedMs(0);
      }

      const timer = window.setInterval(() => {
        setElapsedMs(Date.now() - (clockStartedAtRef.current ?? Date.now()));
      }, 1000);

      return () => {
        window.clearInterval(timer);
      };
    }

    clockStartedAtRef.current = null;
    setElapsedMs(0);
  }, [status]);

  useEffect(() => {
    return () => {
      void stopSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFullscreen = async () => {
    if (!supportsFullscreen || !stageShellRef.current) {
      return;
    }

    try {
      if (document.fullscreenElement === stageShellRef.current) {
        await document.exitFullscreen();
        return;
      }

      await stageShellRef.current.requestFullscreen();
    } catch (fullscreenError) {
      console.error("Failed to toggle fullscreen mode:", fullscreenError);
    }
  };

  return (
    <div
      ref={stageShellRef}
      className={`theme-stage overflow-hidden backdrop-blur ${
        isFullscreen ? "h-screen rounded-none" : "rounded-2xl"
      }`}
    >
      <div className="theme-border flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              status === "connected"
                ? "theme-status-dot-active animate-pulse"
                : status === "connecting"
                  ? "theme-status-dot-warn animate-pulse"
                  : "theme-status-dot"
            }`}
          />
          <div>
            <p className="theme-text-primary text-sm font-semibold">
              {status === "idle" && "Ready to start"}
              {status === "connecting" && "Connecting..."}
              {status === "connected" && "Live session"}
              {status === "disconnected" && "Disconnected"}
              {status === "error" && "Error"}
            </p>
            {sessionId && <p className="theme-text-dim text-xs">Session: {sessionId.slice(0, 8)}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {supportsFullscreen && (
            <button
              type="button"
              onClick={() => {
                void toggleFullscreen();
              }}
              className="theme-button-secondary rounded-lg px-3 py-1.5 text-xs font-semibold"
            >
              {isFullscreen ? "Exit full screen" : "Full screen"}
            </button>
          )}
          <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${environment.accentClassName}`}>
            {environment.shortLabel}
          </span>
          <span className="theme-status-chip rounded border px-2 py-1 text-xs">
            {mode === "audio" && "Audio only"}
            {mode === "video" && "Video only"}
            {mode === "both" && "Audio + Video"}
          </span>
        </div>
      </div>

      {(mode === "video" || mode === "both") && (
        <div
          className={`theme-stage-overlay relative aspect-video overflow-hidden ${environment.shellClassName}`}
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${environment.frameClassName}`} />
          {callEnvironment === "teams" ? (
            renderTeamsScene({
              status,
              elapsedLabel,
              videoRef,
              onLeave: () => {
                void stopSession();
              },
            })
          ) : callEnvironment === "meet" ? (
            renderMeetScene({
              status,
              videoRef,
              onLeave: () => {
                void stopSession();
              },
            })
          ) : (
            <>
              <video
                ref={videoRef}
                className={
                  environment.stageLayout === "audience"
                    ? "pointer-events-none absolute h-px w-px opacity-0"
                    : "absolute inset-0 h-full w-full object-cover"
                }
                playsInline
                muted
              />

              {environment.stageLayout === "audience"
                ? renderAudienceScene(status, environment.label, sessionType)
                : renderPlatformScene(
                    status,
                    environment.label,
                    sessionType,
                    environment.controlClassName
                  )}

              {environment.stageLayout !== "audience" && (
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.12),transparent_22%,transparent_68%,rgba(0,0,0,0.32))]" />
              )}

              {(status === "idle" || status === "error") && (
                <div className="absolute inset-0 flex items-center justify-center px-6">
                  <div className="max-w-md rounded-3xl border border-white/12 bg-black/35 px-6 py-5 text-center shadow-[0_28px_65px_rgba(0,0,0,0.35)] backdrop-blur-md">
                    <div className="theme-icon-badge mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
                      <svg
                        className="theme-accent-text h-8 w-8"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <p className="text-lg font-semibold text-white">{environment.idleTitle}</p>
                    <p className="mt-2 text-sm text-white/70">{environment.idleBody}</p>
                  </div>
                </div>
              )}

              {status === "connecting" && (
                <div className="absolute left-6 bottom-24 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-xs font-semibold text-white/75 backdrop-blur-sm">
                  Building the simulated room...
                </div>
              )}
            </>
          )}
        </div>
      )}

      {mode === "audio" && (
        <div className="theme-stage-muted flex items-center justify-center p-12">
          <div className="text-center">
            <div className="theme-icon-badge mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full">
              <svg
                className="theme-accent-text h-10 w-10"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </div>
            <p className="theme-text-primary text-lg font-semibold">Audio Recording Mode</p>
            <p className="theme-text-muted mt-2 text-sm">
              {status === "connected" ? "Recording your voice..." : "Ready to start"}
            </p>
            <p className="theme-text-dim mt-3 text-xs">
              Visual simulator selected: {environment.label}
            </p>
          </div>
        </div>
      )}

      <div className="theme-border theme-stage-muted border-t px-6 py-4">
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="theme-panel-soft rounded-lg px-3 py-2">
            <p className="theme-text-dim text-xs uppercase tracking-wide">Signaling</p>
            <p className="theme-text-primary mt-1 text-sm font-semibold">{connectionDetails.signaling}</p>
          </div>
          <div className="theme-panel-soft rounded-lg px-3 py-2">
            <p className="theme-text-dim text-xs uppercase tracking-wide">ICE</p>
            <p className="theme-text-primary mt-1 text-sm font-semibold">{connectionDetails.ice}</p>
          </div>
          <div className="theme-panel-soft rounded-lg px-3 py-2">
            <p className="theme-text-dim text-xs uppercase tracking-wide">Peer</p>
            <p className="theme-text-primary mt-1 text-sm font-semibold">{connectionDetails.peer}</p>
          </div>
          <div className="theme-panel-soft rounded-lg px-3 py-2">
            <p className="theme-text-dim text-xs uppercase tracking-wide">Results socket</p>
            <p className="theme-text-primary mt-1 text-sm font-semibold">{connectionDetails.resultsSocket}</p>
          </div>
        </div>

        <div className="flex gap-3">
          {status === "idle" || status === "error" ? (
            <button
              onClick={startSession}
              className="theme-button-primary flex-1 rounded-lg px-6 py-3 font-semibold"
            >
              Start Session
            </button>
          ) : (
            <button
              onClick={() => {
                void stopSession();
              }}
              className="theme-button-secondary flex-1 rounded-lg px-6 py-3 font-semibold"
            >
              Stop Session
            </button>
          )}
        </div>

        {messages.length > 0 && (
          <div className="theme-panel-soft mt-4 max-h-32 space-y-2 overflow-y-auto rounded-lg p-3">
            {messages.slice(-5).map((msg, i) => (
              <div key={i} className="text-xs">
                <span className="theme-accent-text font-mono">{msg.type}:</span>{" "}
                <span className="theme-text-secondary">{JSON.stringify(msg, null, 2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WebRTCRecorder;
