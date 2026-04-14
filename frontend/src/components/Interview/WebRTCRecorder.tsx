import React, { useRef, useState, useEffect } from "react";
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

declare global {
  interface Window {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorLike;
  }
}

interface SignalAnswer {
  sdp: string;
  type: RTCSdpType;
  session_id: string;
}

interface Props {
  mode?: RecordMode;
  onStatusChange?: (status: ConnectionStatus) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onVisionData?: (data: any) => void;
  onRecordingReady?: (recording: SessionRecording | null) => void;
  onStreamReady?: (stream: MediaStream | null) => void;
}

const WebRTCRecorder: React.FC<Props> = ({
  mode = "both",
  onStatusChange,
  onTranscript,
  onVisionData,
  onRecordingReady,
  onStreamReady,
}) => {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
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
  const [messages, setMessages] = useState<any[]>([]);
  const apiBase = getApiBase();
  const wsBase = getWsBase();

  const updateStatus = (newStatus: ConnectionStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
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
    if (!recorder) {
      return;
    }

    if (recorder.state === "inactive") {
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

  const startSession = async () => {
    setError(null);
    updateStatus("connecting");

    try {
      // 1) Get user media based on mode
      const constraints: MediaStreamConstraints = {
        audio: mode === "audio" || mode === "both",
        video: mode === "video" || mode === "both"
          ? { width: { ideal: 1280 }, height: { ideal: 720 } }
          : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      onStreamReady?.(stream);

      // Show local preview if video
      if (videoRef.current && (mode === "video" || mode === "both")) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true; // prevent echo
        await videoRef.current.play().catch(() => {});
      }

      startLocalRecording(stream);

      // 2) Create RTCPeerConnection [web:125]
      const pc = new RTCPeerConnection({
        iceCandidatePoolSize: 4,
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });
      pcRef.current = pc;

      // Monitor connection state
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "connected") updateStatus("connected");
        if (state === "failed" || state === "disconnected") {
          updateStatus("disconnected");
          setError("WebRTC connection lost");
        }
      };

      // Handle ICE candidates (trickle ICE for better reliability)
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          // In production, send candidates to backend via signaling channel
          console.log("ICE candidate:", event.candidate);
        }
      };

      // 3) Add tracks to peer connection [web:124]
      stream
        .getVideoTracks()
        .forEach((track) => {
        pc.addTrack(track, stream);
        console.log(`Added ${track.kind} track to peer connection`);
      });

      const nextSessionId = sessionId ?? crypto.randomUUID();
      setSessionId(nextSessionId);

      void connectResultsWebSocket(nextSessionId).catch((socketError: any) => {
        console.error("Results WebSocket failed:", socketError);
        setError(socketError?.message ?? "Results WebSocket connection failed");
      });

      // 4) Create offer and set local description [web:132][web:135]
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 5) Send offer to FastAPI backend
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
        throw new Error(`Signaling failed: ${response.statusText}`);
      }

      const answer: SignalAnswer = await response.json();
      setSessionId(answer.session_id);

      // 6) Set remote description (answer from backend)
      await pc.setRemoteDescription(new RTCSessionDescription(answer));

      // Start local vision sampling for video modes
      if ((mode === "video" || mode === "both") && videoRef.current) {
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
      }
    } catch (e: any) {
      console.error("WebRTC setup error:", e);
      setError(e?.message ?? "Failed to start WebRTC session");
      updateStatus("error");
    }
  };

  const connectResultsWebSocket = async (sid: string) => {
    const ws = await openWebSocketWithLoopbackFallback(`${wsBase}/ws/results/${sid}`);
    wsRef.current = ws;

    console.log("Results WebSocket connected");

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        setMessages((prev) => [...prev, msg]);

        // Route messages to callbacks
        if (msg.type === "transcript") {
          onTranscript?.(msg.text, msg.isFinal);
        } else if (msg.type === "vision") {
          onVisionData?.(msg);
        }
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      setError("Results WebSocket connection failed");
      updateStatus("error");
    };

    ws.onclose = () => {
      console.log("Results WebSocket closed");
    };
  };

  const stopSession = async () => {
    if (isStoppingRef.current) {
      return;
    }
    isStoppingRef.current = true;

    await stopLocalRecording();

    // Stop media tracks
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
      console.log(`Stopped ${track.kind} track`);
    });
    streamRef.current = null;
    onStreamReady?.(null);

    // Close peer connection
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((sender) => {
        sender.track?.stop();
      });
      pcRef.current.close();
      pcRef.current = null;
    }

    // Close WebSocket
    wsRef.current?.close();
    wsRef.current = null;

    // Clear video preview
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (visionIntervalRef.current) {
      window.clearInterval(visionIntervalRef.current);
      visionIntervalRef.current = null;
    }
    visionEnabledRef.current = false;
    visionBusyRef.current = false;

    updateStatus("idle");
    setSessionId(null);
    isStoppingRef.current = false;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      void stopSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="theme-stage overflow-hidden rounded-2xl backdrop-blur">
      {/* Header */}
      <div className="theme-border flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
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
            {sessionId && (
              <p className="theme-text-dim text-xs">Session: {sessionId.slice(0, 8)}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="theme-status-chip rounded border px-2 py-1 text-xs">
            {mode === "audio" && "🎤 Audio only"}
            {mode === "video" && "📹 Video only"}
            {mode === "both" && "🎥 Audio + Video"}
          </span>
        </div>
      </div>

      {/* Video Preview (if video mode) */}
      {(mode === "video" || mode === "both") && (
        <div className="theme-stage-overlay relative aspect-video">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
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

      {/* Audio-only indicator */}
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

      {/* Controls */}
      <div className="theme-border theme-stage-muted border-t px-6 py-4">
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

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

        {/* Live Messages Display */}
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
