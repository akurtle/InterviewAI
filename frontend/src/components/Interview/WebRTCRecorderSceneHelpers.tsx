import type { ReactElement, RefObject } from "react";
import type { ConnectionStatus, SessionType } from "../../types/interview";

export const formatCallClock = (elapsedMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (value: number) => value.toString().padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `${pad(minutes)}:${pad(seconds)}`;
};

type RenderSceneProps = {
  status: ConnectionStatus;
  videoRef: RefObject<HTMLVideoElement | null> | RefObject<HTMLVideoElement>;
  onLeave: () => void;
};

export const renderTeamsScene = ({
  status,
  elapsedLabel,
  videoRef,
  onLeave,
}: RenderSceneProps & { elapsedLabel: string }): ReactElement => (
  <div className="absolute inset-0 flex flex-col">
    <div className="flex items-center justify-between border-b border-white/10 bg-black/60 px-4 py-3 backdrop-blur-sm">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Microsoft Teams</p>
        <p className="text-sm text-white/90">{status === "connected" ? "Live meeting" : "Preparing your room..."}</p>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-300">
        <span>{elapsedLabel}</span>
        <button
          type="button"
          onClick={onLeave}
          className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-white transition hover:bg-white/15"
        >
          Leave
        </button>
      </div>
    </div>

    <div className="relative flex-1 overflow-hidden">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
      />
      <div className="pointer-events-none absolute right-4 top-4 grid gap-3">
        <div className="theme-panel-soft rounded-3xl border border-white/10 bg-black/50 px-4 py-3 text-xs text-white/90 backdrop-blur">
          <p className="font-semibold">You</p>
          <p className="mt-1 text-slate-300 text-[11px]">Live camera preview</p>
        </div>
        <div className="theme-panel-soft rounded-3xl border border-white/10 bg-black/50 px-4 py-3 text-xs text-white/90 backdrop-blur">
          <p className="font-semibold">Meeting controls</p>
          <p className="mt-1 text-slate-300 text-[11px]">Microphone, camera, raise hand</p>
        </div>
      </div>
    </div>
  </div>
);

type RenderMeetSceneProps = RenderSceneProps;

export const renderMeetScene = ({
  status,
  videoRef,
  onLeave,
}: RenderMeetSceneProps): ReactElement => (
  <div className="absolute inset-0 flex flex-col">
    <div className="flex items-center justify-between border-b border-white/10 bg-black/60 px-4 py-3 backdrop-blur-sm">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Google Meet</p>
        <p className="text-sm text-white/90">{status === "connected" ? "Meeting in progress" : "Starting the room..."}</p>
      </div>
      <button
        type="button"
        onClick={onLeave}
        className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-white transition hover:bg-white/15"
      >
        Leave
      </button>
    </div>

    <div className="relative flex-1 overflow-hidden">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
      />
      <div className="absolute bottom-6 left-6 rounded-3xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white/90 backdrop-blur">
        <p className="font-semibold">Call in progress</p>
        <p className="mt-1 text-slate-300 text-xs">Your voice is being captured for transcription and feedback.</p>
      </div>
    </div>
  </div>
);

export const renderAudienceScene = (
  status: ConnectionStatus,
  label: string,
  sessionType: SessionType
): ReactElement => (
  <div className="absolute inset-0 flex flex-col items-center justify-end p-8">
    <div className="mb-6 rounded-3xl border border-white/10 bg-black/50 px-6 py-5 text-center text-white/90 backdrop-blur">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-300">{label}</p>
      <p className="mt-2 text-sm font-semibold">{sessionType === "interview" ? "Interview practice" : "Pitch rehearsal"}</p>
      <p className="mt-1 text-slate-300 text-xs">{status === "connected" ? "Audience view active" : "Preparing the stage..."}</p>
    </div>
    <div className="grid w-full gap-4 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="h-24 rounded-3xl border border-white/10 bg-white/5"
        />
      ))}
    </div>
  </div>
);

export const renderPlatformScene = (
  status: ConnectionStatus,
  label: string,
  sessionType: SessionType,
  controlClassName: string
): ReactElement => (
  <div className="absolute inset-0 flex flex-col">
    <div className="absolute right-6 top-6 rounded-3xl border border-white/10 bg-black/50 p-4 text-sm text-white/90 backdrop-blur">
      <p className="font-semibold">{label}</p>
      <p className="mt-1 text-slate-300 text-xs">{sessionType === "interview" ? "Interview session" : "Pitch session"}</p>
    </div>
    <div className="absolute bottom-6 left-6 rounded-3xl border border-white/10 bg-black/50 p-4 text-xs text-white/90 backdrop-blur">
      <div className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${controlClassName}`}>
        {status === "connected" ? "Live" : "Ready"}
      </div>
    </div>
  </div>
);
