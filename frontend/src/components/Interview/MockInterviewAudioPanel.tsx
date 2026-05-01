import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  audioStatus: "idle" | "connecting" | "connected" | "recording" | "error";
  isAudioRunning: boolean;
  onToggle: () => void | Promise<void>;
};

const MockInterviewAudioPanel = ({ audioStatus, isAudioRunning, onToggle }: Props) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const supportsFullscreen =
    typeof document !== "undefined" &&
    typeof document.fullscreenEnabled === "boolean" &&
    document.fullscreenEnabled;

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === panelRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const statusMeta = useMemo(() => {
    if (audioStatus === "recording") {
      return {
        label: "Recording...",
        dotClassName: "bg-emerald-500 animate-pulse",
      };
    }

    if (audioStatus === "connecting" || audioStatus === "connected") {
      return {
        label: audioStatus === "connecting" ? "Connecting..." : "Preparing...",
        dotClassName: "bg-yellow-500 animate-pulse",
      };
    }

    if (audioStatus === "error") {
      return {
        label: "Error",
        dotClassName: "bg-red-500",
      };
    }

    return {
      label: "Ready to start",
      dotClassName: "bg-gray-600",
    };
  }, [audioStatus]);

  const toggleFullscreen = async () => {
    if (!supportsFullscreen || !panelRef.current) {
      return;
    }

    try {
      if (document.fullscreenElement === panelRef.current) {
        await document.exitFullscreen();
        return;
      }

      await panelRef.current.requestFullscreen();
    } catch (fullscreenError) {
      console.error("Failed to toggle audio panel fullscreen mode:", fullscreenError);
    }
  };

  return (
    <div
      ref={panelRef}
      className={`theme-panel overflow-hidden backdrop-blur ${
        isFullscreen ? "h-screen rounded-none" : "rounded-2xl"
      }`}
    >
      <div className="theme-border flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${statusMeta.dotClassName}`} />
          <div>
            <p className="theme-text-primary text-sm font-semibold">{statusMeta.label}</p>
            <p className="theme-text-muted text-xs">Audio transcription session</p>
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
          <span className="theme-chip rounded border px-2 py-1 text-xs">Audio only</span>
        </div>
      </div>

      <div className="flex items-center justify-center p-12">
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
          <p className="theme-text-primary text-lg font-semibold">Live Audio Transcription</p>
          <p className="theme-text-muted mt-2 text-sm">
            {audioStatus === "recording" ? "Listening for your response..." : "Ready when you are"}
          </p>
        </div>
      </div>

      <div className="theme-border border-t px-6 py-4">
        {audioStatus === "error" && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <p className="text-sm text-red-300">
              Audio transcription failed. Check microphone access and browser speech recognition support.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              void onToggle();
            }}
            className={`flex-1 rounded-lg px-6 py-3 font-semibold transition ${
              isAudioRunning ? "theme-button-secondary" : "theme-button-primary"
            }`}
          >
            {isAudioRunning ? "Stop Session" : "Start Session"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MockInterviewAudioPanel;
