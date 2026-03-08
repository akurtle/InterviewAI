import type { FeedbackStatus } from "./types";

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

const speechMetricLabels: Array<{ key: string; label: string }> = [
  { key: "total_words", label: "Total words" },
  { key: "filler_count", label: "Filler count" },
  { key: "filler_rate", label: "Filler rate" },
  { key: "unique_word_ratio", label: "Unique word ratio" },
  { key: "avg_sentence_length", label: "Avg sentence length" },
  { key: "sentence_length_std", label: "Sentence length std" },
  { key: "repetition_rate", label: "Repetition rate" },
  { key: "pause_count", label: "Pause count" },
  { key: "avg_pause_seconds", label: "Avg pause (s)" },
  { key: "long_pause_ratio", label: "Long pause ratio" },
  { key: "pause_rate_per_min", label: "Pause rate/min" },
  { key: "speaking_rate_wpm", label: "Speaking rate (wpm)" },
  { key: "total_duration_seconds", label: "Total duration (s)" },
  { key: "talking_time_seconds", label: "Talking time (s)" },
];

const formatSpeechMetric = (key: string, value: any) => {
  if (value === null || value === undefined) return "N/A";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return String(value);

  if (["filler_rate", "unique_word_ratio", "repetition_rate", "long_pause_ratio"].includes(key)) {
    return `${(num * 100).toFixed(1)}%`;
  }

  if (
    [
      "avg_sentence_length",
      "sentence_length_std",
      "avg_pause_seconds",
      "pause_rate_per_min",
      "speaking_rate_wpm",
      "total_duration_seconds",
      "talking_time_seconds",
    ].includes(key)
  ) {
    return num.toFixed(1);
  }

  return Math.round(num).toString();
};

const videoMetricLabels: Array<{ key: string; label: string }> = [
  { key: "frame_count", label: "Frames analyzed" },
  { key: "face_presence_rate", label: "Face presence rate" },
  { key: "gaze_at_camera_rate", label: "Gaze at camera rate" },
  { key: "smile_rate", label: "Smile rate" },
  { key: "avg_smile_prob", label: "Avg smile probability" },
  { key: "head_movement_std", label: "Head movement std" },
  { key: "long_gaze_break_rate", label: "Long gaze break rate" },
  { key: "long_gaze_breaks", label: "Long gaze breaks" },
  { key: "gaze_break_frames", label: "Gaze break frames" },
];

const formatVideoMetric = (key: string, value: any) => {
  if (value === null || value === undefined) return "N/A";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return String(value);

  if (
    ["face_presence_rate", "gaze_at_camera_rate", "smile_rate", "long_gaze_break_rate"].includes(key)
  ) {
    return `${(num * 100).toFixed(1)}%`;
  }

  if (["avg_smile_prob", "head_movement_std"].includes(key)) {
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

  const videoFeedbackScore =
    typeof videoFeedback?.score === "number" ? videoFeedback.score : null;
  const videoMetrics =
    videoFeedback && typeof videoFeedback === "object" ? videoFeedback.metrics ?? null : null;
  const videoWarnings = Array.isArray(videoFeedback?.warnings) ? videoFeedback.warnings : [];
  const videoNotes = Array.isArray(videoFeedback?.feedback) ? videoFeedback.feedback : [];

  return (
    <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white text-lg font-semibold">AI feedback</h2>
        <span className="text-xs text-gray-400">Generated after you stop the session</span>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="p-4 rounded-lg border border-gray-800 bg-black/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm">Speech feedback</h3>
            <span className={`text-xs px-2 py-1 rounded border ${feedbackBadgeClass(speechStatus)}`}>
              {feedbackBadgeLabel(speechStatus)}
            </span>
          </div>

          {speechStatus === "loading" && (
            <p className="text-sm text-gray-400">Analyzing your transcript...</p>
          )}
          {speechStatus === "idle" && (
            <p className="text-sm text-gray-500">Stop the session to generate speech feedback.</p>
          )}
          {speechStatus === "error" && (
            <p className="text-sm text-red-300">
              Unable to fetch speech feedback. Try again after your next run.
            </p>
          )}
          {speechStatus === "ready" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-black/40 px-4 py-3">
                <div>
                  <p className="text-xs text-gray-400">Overall score</p>
                  <p className="text-2xl font-semibold text-white">
                    {speechFeedbackScore !== null ? speechFeedbackScore.toFixed(1) : "N/A"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Based on transcript</p>
                  <p className="text-xs text-gray-400">
                    {typeof speechMetrics?.total_words === "number"
                      ? `${speechMetrics.total_words} words`
                      : "Word count pending"}
                  </p>
                </div>
              </div>

              {speechNotes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Key feedback</p>
                  <ul className="space-y-2 text-sm text-gray-200">
                    {speechNotes.map((note: string, index: number) => (
                      <li key={`${index}-${note.slice(0, 12)}`} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {speechMetrics && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Metrics</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {speechMetricLabels.map((metric) => (
                      <div
                        key={metric.key}
                        className="flex items-center justify-between rounded-lg border border-gray-800 bg-black/40 px-3 py-2"
                      >
                        <span className="text-xs text-gray-400">{metric.label}</span>
                        <span className="text-sm text-white">
                          {formatSpeechMetric(metric.key, speechMetrics?.[metric.key])}
                        </span>
                      </div>
                    ))}
                  </div>
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

              {!speechMetrics && speechNotes.length === 0 && speechWarnings.length === 0 && (
                <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                  {JSON.stringify(speechFeedback, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>

        <div className="p-4 rounded-lg border border-gray-800 bg-black/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm">Video feedback</h3>
            <span className={`text-xs px-2 py-1 rounded border ${feedbackBadgeClass(videoStatus)}`}>
              {feedbackBadgeLabel(videoStatus)}
            </span>
          </div>

          {videoStatus === "loading" && (
            <p className="text-sm text-gray-400">Reviewing visual cues...</p>
          )}
          {videoStatus === "idle" && (
            <p className="text-sm text-gray-500">Stop the session to generate video feedback.</p>
          )}
          {videoStatus === "error" && (
            <p className="text-sm text-red-300">
              Unable to fetch video feedback. Try again after your next run.
            </p>
          )}
          {videoStatus === "ready" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-black/40 px-4 py-3">
                <div>
                  <p className="text-xs text-gray-400">Overall score</p>
                  <p className="text-2xl font-semibold text-white">
                    {videoFeedbackScore !== null ? videoFeedbackScore.toFixed(1) : "N/A"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Based on video frames</p>
                  <p className="text-xs text-gray-400">
                    {typeof videoMetrics?.frame_count === "number"
                      ? `${videoMetrics.frame_count} frames`
                      : "Frame count pending"}
                  </p>
                </div>
              </div>

              {videoNotes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Key feedback</p>
                  <ul className="space-y-2 text-sm text-gray-200">
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
                  <p className="text-xs uppercase tracking-wide text-gray-500">Metrics</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {videoMetricLabels.map((metric) => (
                      <div
                        key={metric.key}
                        className="flex items-center justify-between rounded-lg border border-gray-800 bg-black/40 px-3 py-2"
                      >
                        <span className="text-xs text-gray-400">{metric.label}</span>
                        <span className="text-sm text-white">
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
    </div>
  );
}
