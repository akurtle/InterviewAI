import { CALL_ENVIRONMENT_OPTIONS, CALL_ENVIRONMENT_PRESETS } from "./callEnvironments";
import type { ActiveQuestion, CallEnvironmentId, SessionType } from "../../types/interview";

type Props = {
  activeQuestion: ActiveQuestion | null;
  callEnvironment: CallEnvironmentId;
  onOpenInfo: () => void;
  onOpenSettings: () => void;
  onSelectCallEnvironment: (environment: CallEnvironmentId) => void;
  sessionType: SessionType;
  sessionSaveMessage: string | null;
  sessionSaveStatus: "idle" | "saving" | "saved" | "error";
  userEmail: string | undefined;
};

const MockInterviewHeader = ({
  activeQuestion,
  callEnvironment,
  onOpenInfo,
  onOpenSettings,
  onSelectCallEnvironment,
  sessionType,
  sessionSaveMessage,
  sessionSaveStatus,
  userEmail,
}: Props) => {
  const selectedEnvironment = CALL_ENVIRONMENT_PRESETS[callEnvironment];

  return (
    <>
      <div className="mb-6 flex items-center justify-start">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="theme-ghost-link flex items-center space-x-2 text-sm transition"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back</span>
        </button>
      </div>

      {activeQuestion && (
        <div className="fixed left-6 top-24 z-40 max-w-md">
          <div className="theme-panel-strong rounded-2xl border px-4 py-3 shadow-lg backdrop-blur">
            <p className="theme-accent-text mb-1 text-xs">
              Question {activeQuestion.index + 1} of {activeQuestion.total}
            </p>
            <p className="theme-text-primary text-sm">{activeQuestion.text}</p>
          </div>
        </div>
      )}

      <div className="mb-6 flex justify-end">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenInfo}
            className="theme-button-secondary rounded-lg px-4 py-2 text-sm"
          >
            Info
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="theme-button-secondary rounded-lg px-4 py-2 text-sm"
          >
            Open settings
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="theme-panel rounded-2xl p-5 backdrop-blur">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="theme-chip rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
                  {sessionType === "pitch" ? "Pitch mode" : "Interview mode"}
                </span>

              </div>
              <h1 className="theme-text-primary text-2xl font-semibold">Room simulator</h1>
            </div>

            <div className="flex items-center gap-2">
              <span className="theme-text-dim text-xs uppercase tracking-[0.2em]">Current</span>
              <span
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${selectedEnvironment.accentClassName}`}
              >
                {selectedEnvironment.label}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {CALL_ENVIRONMENT_OPTIONS.map((environment) => {
              const isActive = environment.id === callEnvironment;
              return (
                <button
                  key={environment.id}
                  type="button"
                  onClick={() => onSelectCallEnvironment(environment.id)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    isActive ? "theme-choice-active" : "theme-choice theme-card-hover"
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${environment.accentClassName}`}
                    >
                      {environment.shortLabel}
                    </span>
                    {isActive && (
                      <span className="theme-text-primary text-xs font-semibold">Active</span>
                    )}
                  </div>
                  <p className="theme-text-primary text-sm font-semibold">{environment.label}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mb-6">
        {userEmail ? (
          <div className="theme-panel-soft rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="theme-text-primary text-sm font-semibold">Signed in as {userEmail}</p>
              <span className="theme-chip rounded-full border px-3 py-1 text-xs font-semibold">
                Auto-save on
              </span>
            </div>
            {sessionSaveMessage && (
              <p
                className={`mt-2 text-sm ${
                  sessionSaveStatus === "error"
                    ? "text-red-300"
                    : sessionSaveStatus === "saved"
                      ? "text-emerald-300"
                      : "theme-text-muted"
                }`}
              >
                {sessionSaveMessage}
              </p>
            )}
          </div>
        ) : (
          <div className="theme-panel-soft rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="theme-text-primary text-sm font-semibold">Session saving is off</p>
              <span className="theme-text-muted text-xs">Sign in to save history</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default MockInterviewHeader;
