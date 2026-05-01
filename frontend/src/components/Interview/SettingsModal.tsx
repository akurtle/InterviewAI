import ThemePicker from "../Settings/ThemePicker";
import { CALL_ENVIRONMENT_OPTIONS } from "./callEnvironments";
import type {
  CallEnvironmentId,
  MediaDeviceCatalog,
  MediaDeviceSelection,
  RecordMode,
} from "../../types/interview";

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  recordMode: RecordMode;
  callEnvironment: CallEnvironmentId;
  onSetCallEnvironment: (environment: CallEnvironmentId) => void;
  setRecordMode: (mode: RecordMode) => void;
  mouthTrackingEnabled: boolean;
  onSetMouthTrackingEnabled: (enabled: boolean) => void;
  mediaDevices: MediaDeviceCatalog;
  mediaSelection: MediaDeviceSelection;
  onSelectAudioInput: (deviceId: string) => void;
  onSelectVideoInput: (deviceId: string) => void;
  onRefreshMediaDevices: () => void;
  isRefreshingMediaDevices: boolean;
  mediaDeviceMessage: string | null;
  mediaDeviceLabelsAvailable: boolean;
  isSessionLocked: boolean;
  connectionStatus: string;
  visionData: unknown;
};

export default function SettingsModal({
  isOpen,
  onClose,
  recordMode,
  callEnvironment,
  onSetCallEnvironment,
  setRecordMode,
  mouthTrackingEnabled,
  onSetMouthTrackingEnabled,
  mediaDevices,
  mediaSelection,
  onSelectAudioInput,
  onSelectVideoInput,
  onRefreshMediaDevices,
  isRefreshingMediaDevices,
  mediaDeviceMessage,
  mediaDeviceLabelsAvailable,
  isSessionLocked,
  connectionStatus,
  visionData,
}: SettingsModalProps) {
  if (!isOpen) return null;
  const hasVisionData = visionData !== null && visionData !== undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="theme-panel relative max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl p-6 backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="theme-text-primary text-lg font-semibold">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="theme-button-secondary rounded-lg px-3 py-1.5 text-xs"
          >
            Close
          </button>
        </div>

        <div className="mb-8">
          <ThemePicker
            title="Appearance"
            description="Switch themes without leaving the interview flow. The selection applies across the whole app."
          />
        </div>

        <div className="mb-6">
          <p className="theme-text-muted mb-2 text-sm">Call environment</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CALL_ENVIRONMENT_OPTIONS.map((environment) => (
              <button
                key={environment.id}
                type="button"
                onClick={() => onSetCallEnvironment(environment.id)}
                className={`rounded-lg border px-3 py-3 text-left text-sm transition ${
                  callEnvironment === environment.id
                    ? "theme-choice-active theme-text-primary"
                    : "theme-button-secondary"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{environment.label}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${environment.accentClassName}`}
                  >
                    {environment.shortLabel}
                  </span>
                </div>
                <p className="theme-text-muted mt-2 text-xs leading-5">
                  {environment.helperText}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <p className="theme-text-muted mb-2 text-sm">Recording mode</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRecordMode("both")}
              disabled={isSessionLocked}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                recordMode === "both"
                  ? "theme-choice-active theme-text-primary"
                  : "theme-button-secondary"
              } ${isSessionLocked ? "cursor-not-allowed opacity-50" : ""}`}
            >
              Both
            </button>

            <button
              type="button"
              onClick={() => setRecordMode("video")}
              disabled={isSessionLocked}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                recordMode === "video"
                  ? "theme-choice-active theme-text-primary"
                  : "theme-button-secondary"
              } ${isSessionLocked ? "cursor-not-allowed opacity-50" : ""}`}
            >
              Video
            </button>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => setRecordMode("audio")}
              disabled={isSessionLocked}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                recordMode === "audio"
                  ? "theme-choice-active theme-text-primary"
                  : "theme-button-secondary"
              } ${isSessionLocked ? "cursor-not-allowed opacity-50" : ""}`}
            >
              Audio only
            </button>
          </div>

          {isSessionLocked && (
            <p className="mt-2 text-xs text-yellow-400">
              Stop the session to change recording mode
            </p>
          )}
        </div>

        <div className="theme-panel-soft mb-6 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="theme-text-primary text-sm font-semibold">
                Mouth movement tracking
              </p>
              <p className="theme-text-muted mt-1 text-xs">
                Uses browser-side face metrics during video sessions to estimate
                visible delivery cues without sending camera frames for scoring.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={mouthTrackingEnabled}
              onClick={() => onSetMouthTrackingEnabled(!mouthTrackingEnabled)}
              disabled={isSessionLocked}
              className={`relative inline-flex h-7 w-14 items-center rounded-full border transition ${
                mouthTrackingEnabled
                  ? "theme-choice-active"
                  : "theme-button-secondary"
              } ${isSessionLocked ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                  mouthTrackingEnabled ? "translate-x-8" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <p className="theme-text-muted mt-3 text-xs">
            {mouthTrackingEnabled
              ? "Enabled for new video sessions."
              : "Disabled. Video sessions will skip local mouth articulation analysis."}
          </p>

          {isSessionLocked && (
            <p className="mt-2 text-xs text-yellow-400">
              Stop the session to change mouth tracking
            </p>
          )}
        </div>

        <div className="theme-panel-soft mb-6 rounded-lg p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="theme-text-primary text-sm font-semibold">Input devices</p>
              <p className="theme-text-muted mt-1 text-xs">
                Bluetooth headsets and external webcams appear here after your operating system pairs
                them.
              </p>
            </div>
            <button
              type="button"
              onClick={onRefreshMediaDevices}
              disabled={isRefreshingMediaDevices}
              className={`theme-button-secondary rounded-lg px-3 py-2 text-xs ${
                isRefreshingMediaDevices ? "cursor-wait opacity-70" : ""
              }`}
            >
              {isRefreshingMediaDevices
                ? "Refreshing..."
                : mediaDeviceLabelsAvailable
                  ? "Refresh devices"
                  : "Allow device access"}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="theme-text-muted mb-2 block text-xs uppercase tracking-wide">
                Microphone
              </span>
              <select
                value={mediaSelection.audioInputId}
                onChange={(event) => onSelectAudioInput(event.target.value)}
                disabled={isSessionLocked}
                className={`theme-panel theme-text-primary w-full rounded-lg border px-3 py-2 text-sm ${
                  isSessionLocked ? "cursor-not-allowed opacity-60" : ""
                }`}
              >
                <option value="">System default microphone</option>
                {mediaDevices.audioInputs.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="theme-text-muted mb-2 block text-xs uppercase tracking-wide">
                Camera
              </span>
              <select
                value={mediaSelection.videoInputId}
                onChange={(event) => onSelectVideoInput(event.target.value)}
                disabled={isSessionLocked}
                className={`theme-panel theme-text-primary w-full rounded-lg border px-3 py-2 text-sm ${
                  isSessionLocked ? "cursor-not-allowed opacity-60" : ""
                }`}
              >
                <option value="">System default camera</option>
                {mediaDevices.videoInputs.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {isSessionLocked && (
            <p className="mt-3 text-xs text-yellow-400">
              Stop the session to switch microphones or cameras
            </p>
          )}

          {mediaDeviceMessage && (
            <p className="mt-3 text-xs text-yellow-300">{mediaDeviceMessage}</p>
          )}
        </div>

        <div className="theme-panel-soft mb-6 rounded-lg p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="theme-text-muted text-sm">Connection</span>
            <span
              className={`inline-flex items-center gap-2 rounded px-2 py-1 text-xs font-semibold ${
                connectionStatus === "connected"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : connectionStatus === "connecting"
                    ? "bg-yellow-500/10 text-yellow-400"
                    : connectionStatus === "error"
                      ? "bg-red-500/10 text-red-400"
                      : "bg-gray-800 text-gray-400"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  connectionStatus === "connected"
                    ? "bg-emerald-500 animate-pulse"
                    : connectionStatus === "connecting"
                      ? "bg-yellow-500 animate-pulse"
                      : connectionStatus === "error"
                        ? "bg-red-500"
                        : "bg-gray-600"
                }`}
              />
              {connectionStatus}
            </span>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="theme-text-primary mb-3 flex items-center gap-2 font-semibold">
            <svg className="theme-accent-text h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Mock interview tips
          </h3>
          <ul className="theme-text-muted space-y-2 text-sm">
            <li className="pl-3" style={{ borderLeft: "2px solid var(--accent)" }}>
              Frame your face and shoulders at eye level
            </li>
            <li className="pl-3" style={{ borderLeft: "2px solid var(--accent)" }}>
              Use STAR method: Situation, Task, Action, Result
            </li>
            <li className="pl-3" style={{ borderLeft: "2px solid var(--accent)" }}>
              Speak clearly and pause before key points
            </li>
            <li className="pl-3" style={{ borderLeft: "2px solid var(--accent)" }}>
              Maintain eye contact with the camera
            </li>
            <li className="pl-3" style={{ borderLeft: "2px solid var(--accent)" }}>
              Practice active listening and stay engaged
            </li>
          </ul>
        </div>

        {hasVisionData && (
          <div className="theme-border mt-4 border-t pt-4">
            <h3 className="theme-text-primary mb-3 flex items-center gap-2 font-semibold">
              <svg className="theme-accent-text h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Vision Analysis
            </h3>
            <div className="theme-panel-soft rounded-lg p-3">
              <pre className="theme-text-secondary whitespace-pre-wrap text-xs">
                {JSON.stringify(visionData, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
