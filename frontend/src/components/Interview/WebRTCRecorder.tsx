import React, { useEffect, useRef, useState } from "react";
import {
  fetchWithLoopbackFallback,
  getApiBase,
  getWsBase,
  openWebSocketWithLoopbackFallback,
} from "../../network";
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

type RecorderMessage = {
  type?: string;
  text?: string;
  [key: string]: unknown;
};

type Props = {
  mode?: RecordMode;
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

const waitForIceGatheringComplete = (pc: RTCPeerConnection, timeoutMs = 2500) =>
  new Promise<void>((resolve) => {
    if (pc.iceGatheringState === "complete") {
      resolve();
      return;
    }

    const timeout = window.setTimeout(() => {
      cleanup();
      resolve();
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timeout);
      pc.removeEventListener("icegatheringstatechange", handleChange);
    };

    const handleChange = () => {
      if (pc.iceGatheringState === "complete") {
        cleanup();
        resolve();
      }
    };

    pc.addEventListener("icegatheringstatechange", handleChange);
  });

const WebRTCRecorder: React.FC<Props> = ({
  mode = "both",
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
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const resultsHeartbeatRef = useRef<number | null>(null);
  const resultsReconnectTimerRef = useRef<number | null>(null);
  const resultsReconnectAttemptsRef = useRef(0);
  const sessionActiveRef = useRef(false);
  const configRef = useRef<WebRTCConfig | null>(null);
  const pendingIceCandidatesRef = useRef<IceCandidatePayload[]>([]);
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

  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
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

  const postIceCandidate = async (sid: string, candidate: IceCandidatePayload) => {
    await fetchWithLoopbackFallback(`${apiBase}/webrtc/candidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sid,
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
        usernameFragment: candidate.usernameFragment ?? null,
      }),
    });
  };

  const flushPendingIceCandidates = async (sid: string) => {
    const pending = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];

    for (const candidate of pending) {
      try {
        await postIceCandidate(sid, candidate);
      } catch (candidateError) {
        console.error("Failed to send pending ICE candidate:", candidateError);
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

    ws.onmessage = (event) => {
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

        if (msg.type === "vision") {
          onVisionData?.(msg);
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
        if (!event.candidate) {
          return;
        }

        const payload: IceCandidatePayload = {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          usernameFragment:
            "usernameFragment" in event.candidate
              ? (event.candidate as RTCPeerConnectionIceEvent["candidate"] & {
                  usernameFragment?: string | null;
                }).usernameFragment ?? null
              : null,
        };

        if (!sessionId && !nextSessionId) {
          pendingIceCandidatesRef.current.push(payload);
          return;
        }

        void postIceCandidate(nextSessionId, payload).catch((candidateError) => {
          console.error("Failed to send ICE candidate:", candidateError);
          pendingIceCandidatesRef.current.push(payload);
        });
      };

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      await connectResultsWebSocket(nextSessionId);
      updateConnectionDetails({ signaling: "creating_offer" });

      const offer = await pc.createOffer();
      onStartupMetric?.("offer_created_ms");
      await pc.setLocalDescription(offer);
      await waitForIceGatheringComplete(pc);
      onStartupMetric?.("ice_gathering_complete_ms");

      const response = await fetchWithLoopbackFallback(`${apiBase}/webrtc/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sdp: pc.localDescription?.sdp,
          type: pc.localDescription?.type,
          session_id: nextSessionId,
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
    return () => {
      void stopSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="theme-stage overflow-hidden rounded-2xl backdrop-blur">
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
          <span className="theme-status-chip rounded border px-2 py-1 text-xs">
            {mode === "audio" && "Audio only"}
            {mode === "video" && "Video only"}
            {mode === "both" && "Audio + Video"}
          </span>
        </div>
      </div>

      {(mode === "video" || mode === "both") && (
        <div className="theme-stage-overlay relative aspect-video">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          {status === "idle" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="theme-icon-badge mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl">
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
                <p className="theme-text-primary font-semibold">Start session to begin</p>
              </div>
            </div>
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
