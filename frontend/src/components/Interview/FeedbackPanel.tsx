import type { FeedbackStatus, QuestionResponseReview } from "../../types/interview";

type FeedbackPanelProps = {
  speechFeedback: unknown;
  videoFeedback: unknown;
  speechStatus: FeedbackStatus;
  videoStatus: FeedbackStatus;
  error: string | null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const feedbackBadgeClass = (status: FeedbackStatus) =>
  status === "ready"
    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
    : status === "loading"
      ? "bg-yellow-500/10 text-yellow-300 border-yellow-500/30"
      : status === "error"
        ? "bg-red-500/10 text-red-300 border-red-500/30"
        : "bg-gray-800 text-gray-400 border-gray-700";

const feedbackBadgeLabel = (status: FeedbackStatus) =>
  status === "ready" ? "Ready" : status === "loading" ? "Loading" : status === "error" ? "Error" : "Idle";

export default function FeedbackPanel({
  speechFeedback,
  videoFeedback,
  speechStatus,
  videoStatus,
  error,
}: FeedbackPanelProps) {
  const speechData = asRecord(speechFeedback);
  const videoData = asRecord(videoFeedback);
  const speechFeedbackScore =
    typeof speechData?.score === "number" ? speechData.score : null;
  const speechWarnings = asStringArray(speechData?.warnings);
  const speechNotes = asStringArray(speechData?.feedback);
  const responseScore =
    typeof speechData?.response_score === "number" ? speechData.response_score : null;
  const responseNotes = asStringArray(speechData?.response_feedback);
  const questionReviews = Array.isArray(speechData?.question_reviews)
    ? (speechData.question_reviews as QuestionResponseReview[])
    : [];

  const videoFeedbackScore =
    typeof videoData?.score === "number" ? videoData.score : null;
  const videoWarnings = asStringArray(videoData?.warnings);
  const videoNotes = asStringArray(videoData?.feedback);

  return (
    <div className="theme-panel rounded-2xl p-6 backdrop-blur">
      <div className="flex items-center justify-between mb-4">
        <h2 className="theme-text-primary text-lg font-semibold">AI feedback</h2>
        <span className="theme-text-muted text-xs">Generated after you stop the session</span>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="theme-panel-soft rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="theme-text-primary text-sm font-semibold">Speech feedback</h3>
            <span className={`text-xs px-2 py-1 rounded border ${feedbackBadgeClass(speechStatus)}`}>
              {feedbackBadgeLabel(speechStatus)}
            </span>
          </div>

          {speechStatus === "loading" && (
            <p className="theme-text-muted text-sm">Analyzing your transcript...</p>
          )}
          {speechStatus === "idle" && (
            <p className="theme-text-dim text-sm">Stop the session to generate speech feedback.</p>
          )}
          {speechStatus === "error" && (
            <p className="text-sm text-red-300">
              Unable to fetch speech feedback. Try again after your next run.
            </p>
          )}
          {speechStatus === "ready" && (
            <div className="space-y-4">
              <div className="theme-panel-strong flex items-center justify-between rounded-lg px-4 py-3">
                <div>
                  <p className="theme-text-muted text-xs">Overall score</p>
                  <p className="theme-text-primary text-2xl font-semibold">
                    {speechFeedbackScore !== null ? speechFeedbackScore.toFixed(1) : "N/A"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="theme-text-dim text-xs">Transcript review</p>
                </div>
              </div>

              {speechNotes.length > 0 && (
                <div className="space-y-2">
                  <p className="theme-text-dim text-xs uppercase tracking-wide">Key feedback</p>
                  <ul className="theme-text-secondary space-y-2 text-sm">
                    {speechNotes.map((note: string, index: number) => (
                      <li key={`${index}-${note.slice(0, 12)}`} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {speechWarnings.length > 0 && (
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
                  <p className="text-xs uppercase tracking-wide text-yellow-300 mb-2">Warnings</p>
                  <ul className="space-y-1 text-sm text-yellow-200">
                    {speechWarnings.map((warning: string, index: number) => (
                      <li key={`${index}-${warning.slice(0, 12)}`}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {speechNotes.length === 0 && speechWarnings.length === 0 && (
                <p className="theme-text-muted text-sm">
                  Feedback generated, but no additional speech notes were returned.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="theme-panel-soft rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="theme-text-primary text-sm font-semibold">Video feedback</h3>
            <span className={`text-xs px-2 py-1 rounded border ${feedbackBadgeClass(videoStatus)}`}>
              {feedbackBadgeLabel(videoStatus)}
            </span>
          </div>

          {videoStatus === "loading" && (
            <p className="theme-text-muted text-sm">Reviewing visual cues...</p>
          )}
          {videoStatus === "idle" && (
            <p className="theme-text-dim text-sm">Stop the session to generate video feedback.</p>
          )}
          {videoStatus === "error" && (
            <p className="text-sm text-red-300">
              Unable to fetch video feedback. Try again after your next run.
            </p>
          )}
          {videoStatus === "ready" && (
            <div className="space-y-4">
              <div className="theme-panel-strong flex items-center justify-between rounded-lg px-4 py-3">
                <div>
                  <p className="theme-text-muted text-xs">Overall score</p>
                  <p className="theme-text-primary text-2xl font-semibold">
                    {videoFeedbackScore !== null ? videoFeedbackScore.toFixed(1) : "N/A"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="theme-text-dim text-xs">Visual delivery review</p>
                </div>
              </div>

              {videoNotes.length > 0 && (
                <div className="space-y-2">
                  <p className="theme-text-dim text-xs uppercase tracking-wide">Key feedback</p>
                  <ul className="theme-text-secondary space-y-2 text-sm">
                    {videoNotes.map((note: string, index: number) => (
                      <li key={`${index}-${note.slice(0, 12)}`} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {videoWarnings.length > 0 && (
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
                  <p className="text-xs uppercase tracking-wide text-yellow-300 mb-2">Warnings</p>
                  <ul className="space-y-1 text-sm text-yellow-200">
                    {videoWarnings.map((warning: string, index: number) => (
                      <li key={`${index}-${warning.slice(0, 12)}`}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {videoNotes.length === 0 && videoWarnings.length === 0 && (
                <p className="theme-text-muted text-sm">
                  Feedback generated, but no additional video notes were returned.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {questionReviews.length > 0 && (
        <div className="theme-panel-soft mt-4 rounded-lg p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="theme-text-primary text-sm font-semibold">Response quality</h3>
              <p className="theme-text-muted text-xs">Question-by-question text review</p>
            </div>
            <div className="text-right">
              <p className="theme-text-muted text-xs">Overall response score</p>
              <p className="theme-text-primary text-xl font-semibold">
                {responseScore !== null ? responseScore.toFixed(1) : "N/A"}
              </p>
            </div>
          </div>

          {responseNotes.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="theme-text-dim text-xs uppercase tracking-wide">Overall notes</p>
              <ul className="theme-text-secondary space-y-2 text-sm">
                {responseNotes.map((note: string, index: number) => (
                  <li key={`${index}-${note.slice(0, 12)}`} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-300" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-3">
            {questionReviews.map((review) => (
              <div key={`review-${review.index}`} className="theme-panel-strong rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="theme-text-dim text-xs uppercase tracking-wide">
                      Question {review.index + 1}
                    </p>
                    <p className="theme-text-primary mt-1 text-sm font-semibold">
                      {review.question}
                    </p>
                    <p className="theme-text-muted mt-2 text-sm">{review.summary}</p>
                  </div>
                  <div className="text-right">
                    <p className="theme-text-muted text-xs">Score</p>
                    <p className="theme-text-primary text-lg font-semibold">
                      {review.score.toFixed(1)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-4">
                  {Object.entries(review.dimension_scores).map(([key, value]) => (
                    <div key={key} className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                      <p className="theme-text-dim text-[11px] uppercase tracking-wide">
                        {key.replace(/_/g, " ")}
                      </p>
                      <p className="theme-text-primary text-sm font-semibold">{value.toFixed(1)}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="theme-text-dim text-xs uppercase tracking-wide">Strengths</p>
                    <ul className="theme-text-secondary mt-2 space-y-2 text-sm">
                      {review.strengths.map((item, index) => (
                        <li key={`${review.index}-strength-${index}`} className="flex gap-2">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="theme-text-dim text-xs uppercase tracking-wide">Improve next</p>
                    <ul className="theme-text-secondary mt-2 space-y-2 text-sm">
                      {review.improvements.map((item, index) => (
                        <li key={`${review.index}-improve-${index}`} className="flex gap-2">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-300" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
