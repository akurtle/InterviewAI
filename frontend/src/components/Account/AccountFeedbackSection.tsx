import {
  formatLabel,
  formatMetricValue,
  formatScore,
} from "./accountUtils";
import type { FeedbackPayload } from "../../types/account";

type Props = {
  title: string;
  accent: string;
  payload: FeedbackPayload;
};

const AccountFeedbackSection = ({ title, accent, payload }: Props) => {
  if (!payload) {
    return (
      <section className="theme-panel rounded-3xl p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="theme-text-primary text-xl font-semibold">{title}</p>
            <p className="theme-text-muted mt-2 text-sm">No saved feedback for this session.</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${accent}`}
          >
            N/A
          </span>
        </div>
      </section>
    );
  }

  const feedback = Array.isArray(payload.feedback) ? payload.feedback : [];
  const warnings = Array.isArray(payload.warnings) ? payload.warnings : [];
  const metrics = payload.metrics ?? {};

  return (
    <section className="theme-panel rounded-3xl p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="theme-text-primary text-xl font-semibold">{title}</p>
          <p className="theme-text-muted mt-2 text-sm">Stored analysis from the completed session.</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${accent}`}
        >
          {formatScore(payload.score)}
        </span>
      </div>

      {feedback.length > 0 && (
        <div className="mb-5">
          <p className="theme-text-dim text-xs uppercase tracking-[0.2em]">Coaching Notes</p>
          <div className="mt-3 space-y-3">
            {feedback.map((item) => (
              <div key={item} className="theme-panel-soft rounded-2xl p-4">
                <p className="theme-text-secondary text-sm leading-6">{item}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mb-5">
          <p className="theme-text-dim text-xs uppercase tracking-[0.2em]">Warnings</p>
          <div className="mt-3 space-y-2">
            {warnings.map((item) => (
              <div key={item} className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-3">
                <p className="text-sm text-yellow-100">{item}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="theme-text-dim text-xs uppercase tracking-[0.2em]">Metrics</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {Object.entries(metrics).map(([key, value]) => (
            <div key={key} className="theme-panel-soft rounded-2xl p-4">
              <p className="theme-text-dim text-xs uppercase tracking-wide">{formatLabel(key)}</p>
              <p className="theme-text-primary mt-2 text-lg font-semibold">
                {formatMetricValue(value)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AccountFeedbackSection;
