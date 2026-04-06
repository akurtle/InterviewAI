import React, { useRef, useState, useEffect } from "react";
import {
  fetchWithLoopbackFallback,
  getApiBase,
  getWsBase,
  openWebSocketWithLoopbackFallback,
} from "../../network";

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
}

const WebRTCRecorder: React.FC<Props> = ({
  mode = "both",
  onStatusChange,
  onTranscript,
  onVisionData,
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

      // Show local preview if video
      if (videoRef.current && (mode === "video" || mode === "both")) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true; // prevent echo
        await videoRef.current.play().catch(() => {});
      }

      // 2) Create RTCPeerConnection [web:125]
      const pc = new RTCPeerConnection({
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
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
        console.log(`Added ${track.kind} track to peer connection`);
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
          session_id: null,
        }),
      });

      if (!response.ok) {
        throw new Error(`Signaling failed: ${response.statusText}`);
      }

      const answer: SignalAnswer = await response.json();
      setSessionId(answer.session_id);

      // 6) Set remote description (answer from backend)
      await pc.setRemoteDescription(new RTCSessionDescription(answer));

      // 7) Connect WebSocket for receiving AI results
      await connectResultsWebSocket(answer.session_id);

      updateStatus("connected");

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

  const stopSession = () => {
    // Stop media tracks
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
      console.log(`Stopped ${track.kind} track`);
    });
    streamRef.current = null;

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
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              status === "connected"
                ? "bg-emerald-500 animate-pulse"
                : status === "connecting"
                ? "bg-yellow-500 animate-pulse"
                : "bg-gray-600"
            }`}
          />
          <div>
            <p className="text-white font-semibold text-sm">
              {status === "idle" && "Ready to start"}
              {status === "connecting" && "Connecting..."}
              {status === "connected" && "Live session"}
              {status === "disconnected" && "Disconnected"}
              {status === "error" && "Error"}
            </p>
            {sessionId && (
              <p className="text-xs text-gray-400">Session: {sessionId.slice(0, 8)}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/30">
            {mode === "audio" && "🎤 Audio only"}
            {mode === "video" && "📹 Video only"}
            {mode === "both" && "🎥 Audio + Video"}
          </span>
        </div>
      </div>

      {/* Video Preview (if video mode) */}
      {(mode === "video" || mode === "both") && (
        <div className="relative aspect-video bg-black">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          {status === "idle" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-emerald-400"
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
                <p className="text-white font-semibold">Start session to begin</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audio-only indicator */}
      {mode === "audio" && (
        <div className="p-12 bg-linear-to-br from-gray-900 to-black flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-10 h-10 text-emerald-400"
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
            <p className="text-white font-semibold text-lg">Audio Recording Mode</p>
            <p className="text-gray-400 text-sm mt-2">
              {status === "connected" ? "Recording your voice..." : "Ready to start"}
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="px-6 py-4 border-t border-gray-800 bg-black/20">
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          {status === "idle" || status === "error" ? (
            <button
              onClick={startSession}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold transition"
            >
              Start Session
            </button>
          ) : (
            <button
              onClick={stopSession}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold transition"
            >
              Stop Session
            </button>
          )}
        </div>

        {/* Live Messages Display */}
        {messages.length > 0 && (
          <div className="mt-4 max-h-32 overflow-y-auto bg-black/40 rounded-lg p-3 space-y-2">
            {messages.slice(-5).map((msg, i) => (
              <div key={i} className="text-xs">
                <span className="text-emerald-400 font-mono">{msg.type}:</span>{" "}
                <span className="text-gray-300">{JSON.stringify(msg, null, 2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WebRTCRecorder;
