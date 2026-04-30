import type { FeedbackStatus, QuestionResponseReview } from "../../types/interview";

type FeedbackPanelProps = {
  speechFeedback: any;
  videoFeedback: any;
  speechStatus: FeedbackStatus;
  videoStatus: FeedbackStatus;
  error: string | null;
};

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

const videoMetricLabels: Array<{ key: string; label: string }> = [
  { key: "frame_count", label: "Frames analyzed" },
  { key: "mouth_frame_count", label: "Mouth frames" },
  { key: "face_presence_rate", label: "Face presence rate" },
  { key: "gaze_at_camera_rate", label: "Gaze at camera rate" },
  { key: "smile_rate", label: "Smile rate" },
  { key: "avg_smile_prob", label: "Avg smile probability" },
  { key: "head_movement_std", label: "Head movement std" },
  { key: "long_gaze_break_rate", label: "Long gaze break rate" },
  { key: "long_gaze_breaks", label: "Long gaze breaks" },
  { key: "gaze_break_frames", label: "Gaze break frames" },
  { key: "avg_mouth_open_ratio", label: "Avg mouth openness" },
  { key: "avg_mouth_movement_delta", label: "Avg mouth movement" },
  { key: "articulation_active_rate", label: "Active articulation rate" },
];

const formatVideoMetric = (key: string, value: any) => {
  if (value === null || value === undefined) return "N/A";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return String(value);

  if (
    [
      "face_presence_rate",
      "gaze_at_camera_rate",
      "smile_rate",
      "long_gaze_break_rate",
      "avg_mouth_open_ratio",
      "articulation_active_rate",
    ].includes(key)
  ) {
    return `${(num * 100).toFixed(1)}%`;
  }

  if (["avg_smile_prob", "head_movement_std", "avg_mouth_movement_delta"].includes(key)) {
    return num.toFixed(2);
  }

  return Math.round(num).toString();
};

export default function FeedbackPanel({
  speechFeedback,
  videoFeedback,
  speechStatus,
  videoStatus,
  error,
}: FeedbackPanelProps) {
  const speechFeedbackScore =
    typeof speechFeedback?.score === "number" ? speechFeedback.score : null;
  const speechMetrics =
    speechFeedback && typeof speechFeedback === "object" ? speechFeedback.metrics ?? null : null;
  const speechWarnings = Array.isArray(speechFeedback?.warnings) ? speechFeedback.warnings : [];
  const speechNotes = Array.isArray(speechFeedback?.feedback) ? speechFeedback.feedback : [];
  const responseScore =
    typeof speechFeedback?.response_score === "number" ? speechFeedback.response_score : null;
  const responseMetrics =
    speechFeedback && typeof speechFeedback === "object"
      ? speechFeedback.response_metrics ?? null
      : null;
  const responseNotes = Array.isArray(speechFeedback?.response_feedback)
    ? speechFeedback.response_feedback
    : [];
  const questionReviews = Array.isArray(speechFeedback?.question_reviews)
    ? (speechFeedback.question_reviews as QuestionResponseReview[])
    : [];

  const videoFeedbackScore =
    typeof videoFeedback?.score === "number" ? videoFeedback.score : null;
  const videoMetrics =
    videoFeedback && typeof videoFeedback === "object" ? videoFeedback.metrics ?? null : null;
  const videoWarnings = Array.isArray(videoFeedback?.warnings) ? videoFeedback.warnings : [];
  const videoNotes = Array.isArray(videoFeedback?.feedback) ? videoFeedback.feedback : [];

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
                  <p className="theme-text-dim text-xs">Based on transcript</p>
                  <p className="theme-text-muted text-xs">
                    {typeof speechMetrics?.total_words === "number"
                      ? `${speechMetrics.total_words} words`
                      : "Word count pending"}
                  </p>
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

              {/* {speechMetrics && (
                <div className="space-y-2">
                  <p className="theme-text-dim text-xs uppercase tracking-wide">Metrics</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {speechMetricLabels.map((metric) => (
                      <div
                        key={metric.key}
                        className="theme-panel-strong flex items-center justify-between rounded-lg px-3 py-2"
                      >
                        <span className="theme-text-muted text-xs">{metric.label}</span>
                        <span className="theme-text-primary text-sm">
                          {formatSpeechMetric(metric.key, speechMetrics?.[metric.key])}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )} */}

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

              {!speechMetrics && speechNotes.length === 0 && speechWarnings.length === 0 && (
                <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                  {JSON.stringify(speechFeedback, null, 2)}
                </pre>
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
                  <p className="theme-text-dim text-xs">Based on video frames</p>
                  <p className="theme-text-muted text-xs">
                    {typeof videoMetrics?.frame_count === "number"
                      ? `${videoMetrics.frame_count} frames`
                      : "Frame count pending"}
                  </p>
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

              {videoMetrics && (
                <div className="space-y-2">
                  <p className="theme-text-dim text-xs uppercase tracking-wide">Metrics</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {videoMetricLabels.map((metric) => (
                      <div
                        key={metric.key}
                        className="theme-panel-strong flex items-center justify-between rounded-lg px-3 py-2"
                      >
                        <span className="theme-text-muted text-xs">{metric.label}</span>
                        <span className="theme-text-primary text-sm">
                          {formatVideoMetric(metric.key, videoMetrics?.[metric.key])}
                        </span>
                      </div>
                    ))}
                  </div>
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

              {!videoMetrics && videoNotes.length === 0 && videoWarnings.length === 0 && (
                <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                  {JSON.stringify(videoFeedback, null, 2)}
                </pre>
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

          {responseMetrics && (
            <div className="mb-4 grid gap-2 sm:grid-cols-3">
              <div className="theme-panel-strong rounded-lg px-3 py-2">
                <p className="theme-text-muted text-xs">Reviewed questions</p>
                <p className="theme-text-primary text-sm font-semibold">
                  {typeof responseMetrics.reviewed_questions === "number"
                    ? responseMetrics.reviewed_questions
                    : "N/A"}
                </p>
              </div>
              <div className="theme-panel-strong rounded-lg px-3 py-2">
                <p className="theme-text-muted text-xs">Avg answer length</p>
                <p className="theme-text-primary text-sm font-semibold">
                  {typeof responseMetrics.avg_answer_word_count === "number"
                    ? `${responseMetrics.avg_answer_word_count.toFixed(1)} words`
                    : "N/A"}
                </p>
              </div>
              <div className="theme-panel-strong rounded-lg px-3 py-2">
                <p className="theme-text-muted text-xs">Score consistency</p>
                <p className="theme-text-primary text-sm font-semibold">
                  {typeof responseMetrics.score_stddev === "number"
                    ? responseMetrics.score_stddev.toFixed(1)
                    : "N/A"}
                </p>
              </div>
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
