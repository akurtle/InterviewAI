import React, { useEffect, useRef, useState } from "react";
import { CALL_ENVIRONMENT_PRESETS } from "./callEnvironments";
import type {
  CallEnvironmentId,
  ConnectionStatus,
  RecordMode,
  SessionRecording,
  SessionType,
} from "../../types/interview";
import {
  formatCallClock,
  renderAudienceScene,
  renderMeetScene,
  renderPlatformScene,
  renderTeamsScene,
} from "./WebRTCRecorderSceneHelpers";

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

type Props = {
  mode?: RecordMode;
  sessionType?: SessionType;
  callEnvironment?: CallEnvironmentId;
  selectedAudioInputId?: string;
  selectedVideoInputId?: string;
  onPreferredDevicesUnavailable?: (kinds: Array<"audioinput" | "videoinput">) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  onVisionData?: (data: unknown) => void;
  onRecordingReady?: (recording: SessionRecording | null) => void;
  onStreamReady?: (stream: MediaStream | null) => void;
};

declare global {
  interface Window {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorLike;
  }
}

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

const WebRTCRecorder: React.FC<Props> = ({
  mode = "both",
  sessionType = "interview",
  callEnvironment = "teams",
  selectedAudioInputId,
  selectedVideoInputId,
  onPreferredDevicesUnavailable,
  onStatusChange,
  onVisionData,
  onRecordingReady,
  onStreamReady,
}) => {
  const stageShellRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
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

    // Keep client-side vision sampling lightweight so the interview UI stays responsive.
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
    updateStatus("connecting");

    try {
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

      if (videoRef.current && (mode === "video" || mode === "both")) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => {});
      }

      startLocalRecording(stream);

      startVisionSampling();
      updateStatus("connected");
    } catch (sessionError: unknown) {
      console.error("Local media setup error:", sessionError);
      setError(sessionError instanceof Error ? sessionError.message : "Failed to start local media session");
      updateStatus("error");
    }
  };

  const stopSession = async () => {
    if (isStoppingRef.current) {
      return;
    }
    isStoppingRef.current = true;

    await stopLocalRecording();

    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    streamRef.current = null;
    onStreamReady?.(null);

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

      </div>
    </div>
  );
};

export default WebRTCRecorder;
