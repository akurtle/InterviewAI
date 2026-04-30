import type { StoredInterviewSessionSummary } from "../../types/session";
import {
  formatDateTime,
  formatDuration,
  formatDurationSeconds,
  formatScore,
} from "./accountUtils";

type Props = {
  selectedSessionId: string | null;
  sessions: StoredInterviewSessionSummary[];
  onSelect: (sessionId: string) => void;
};

const AccountSessionList = ({ selectedSessionId, sessions, onSelect }: Props) => {
  return (
    <aside className="space-y-4">
      {sessions.map((session) => {
        const isSelected = session.id === selectedSessionId;

        return (
          <button
            key={session.id}
            type="button"
            onClick={() => onSelect(session.id)}
            className={`theme-panel block w-full rounded-3xl p-5 text-left transition ${
              isSelected ? "ring-2 ring-[var(--theme-accent)]" : "hover:-translate-y-0.5"
            }`}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="theme-text-primary text-lg font-semibold">
                  {session.session_type === "pitch" ? "Pitch practice" : "Interview practice"}
                </p>
                <p className="theme-text-muted mt-1 text-sm">{formatDateTime(session.created_at)}</p>
              </div>
              <span className="theme-chip rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em]">
                {session.record_mode}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="theme-panel-soft rounded-2xl p-4">
                <p className="theme-text-dim text-xs uppercase tracking-wide">Speech</p>
                <p className="theme-text-primary mt-2 text-2xl font-semibold">
                  {formatScore(session.speech_score)}
                </p>
              </div>
              <div className="theme-panel-soft rounded-2xl p-4">
                <p className="theme-text-dim text-xs uppercase tracking-wide">Video</p>
                <p className="theme-text-primary mt-2 text-2xl font-semibold">
                  {formatScore(session.video_score)}
                </p>
              </div>
            </div>

            <div className="theme-border mt-4 border-t pt-4">
              <p className="theme-text-secondary text-sm">{session.role || "General practice"}</p>
              <p className="theme-text-muted mt-1 text-xs uppercase tracking-[0.18em]">
                {session.duration_seconds > 0
                  ? `${formatDurationSeconds(session.duration_seconds)} session`
                  : formatDuration(session.started_at, session.ended_at)}
              </p>
            </div>
          </button>
        );
      })}
    </aside>
  );
};

export default AccountSessionList;
