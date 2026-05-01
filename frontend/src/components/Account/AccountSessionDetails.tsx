import { useMemo } from "react";
import type {
  StoredInterviewSession,
  StoredInterviewSessionAnswer,
} from "../../types/session";
import AccountFeedbackSection from "./AccountFeedbackSection";
import {
  buildQuestionAnswerSections,
  formatDateTime,
  formatDuration,
  formatDurationSeconds,
  formatFileSize,
  getContextFieldLabels,
} from "./accountUtils";
import type { FeedbackPayload } from "../../types/account";

type Props = {
  detailStatus: "idle" | "loading" | "ready" | "error";
  error: string | null;
  recordingError: string | null;
  recordingStatus: "idle" | "loading" | "ready" | "error";
  recordingUrl: string | null;
  selectedSession: StoredInterviewSession | null;
  selectedSessionAnswers: StoredInterviewSessionAnswer[];
};

const AccountSessionDetails = ({
  detailStatus,
  error,
  recordingError,
  recordingStatus,
  recordingUrl,
  selectedSession,
  selectedSessionAnswers,
}: Props) => {
  const transcriptReview = useMemo(
    () =>
      selectedSession
        ? buildQuestionAnswerSections(selectedSession, selectedSessionAnswers)
        : null,
    [selectedSession, selectedSessionAnswers]
  );

  const selectedContextLabels = useMemo(
    () => (selectedSession ? getContextFieldLabels(selectedSession.session_type) : null),
    [selectedSession]
  );

  if (detailStatus === "loading") {
    return (
      <section className="theme-panel rounded-3xl p-8">
        <p className="theme-text-primary text-lg font-semibold">Loading session details</p>
        <p className="theme-text-muted mt-2 text-sm">
          Fetching the full transcript, questions, and feedback for the selected session.
        </p>
      </section>
    );
  }

  if (detailStatus === "error" && !selectedSession) {
    return (
      <section className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6">
        <p className="text-sm text-red-100">{error ?? "Failed to load the selected session."}</p>
      </section>
    );
  }

  if (!selectedSession) {
    return (
      <section className="theme-panel rounded-3xl p-8">
        <p className="theme-text-primary text-lg font-semibold">Select a session</p>
        <p className="theme-text-muted mt-2 text-sm">
          Choose a saved interview or pitch session to review its transcript, questions, and feedback.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="theme-panel rounded-3xl p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="theme-accent-text text-sm uppercase tracking-[0.24em]">
              {selectedSession.session_type === "pitch" ? "Pitch Session" : "Interview Session"}
            </p>
            <h2 className="theme-text-primary mt-3 text-3xl font-bold">
              {selectedSession.question_context?.role || "General practice"}
            </h2>
            <p className="theme-text-muted mt-3 text-sm">
              {formatDateTime(selectedSession.created_at)} |{" "}
              {formatDuration(selectedSession.started_at, selectedSession.ended_at)}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="theme-panel-soft rounded-2xl p-4 text-center">
              <p className="theme-text-dim text-xs uppercase tracking-wide">Questions</p>
              <p className="theme-text-primary mt-2 text-3xl font-semibold">
                {selectedSession.questions?.length ?? 0}
              </p>
            </div>
            <div className="theme-panel-soft rounded-2xl p-4 text-center">
              <p className="theme-text-dim text-xs uppercase tracking-wide">Transcript Items</p>
              <p className="theme-text-primary mt-2 text-3xl font-semibold">
                {selectedSession.transcripts?.length ?? 0}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="theme-panel-soft rounded-2xl p-4">
            <p className="theme-text-dim text-xs uppercase tracking-wide">
              {selectedContextLabels?.company}
            </p>
            <p className="theme-text-primary mt-2 text-lg font-semibold">
              {selectedSession.question_context?.company || "N/A"}
            </p>
          </div>
          <div className="theme-panel-soft rounded-2xl p-4">
            <p className="theme-text-dim text-xs uppercase tracking-wide">
              {selectedContextLabels?.callType}
            </p>
            <p className="theme-text-primary mt-2 text-lg font-semibold">
              {selectedSession.question_context?.callType || "N/A"}
            </p>
          </div>
          <div className="theme-panel-soft rounded-2xl p-4">
            <p className="theme-text-dim text-xs uppercase tracking-wide">Record Mode</p>
            <p className="theme-text-primary mt-2 text-lg font-semibold">
              {selectedSession.record_mode}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 2xl:grid-cols-2">
        <section className="theme-panel rounded-3xl p-6 2xl:col-span-2">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="theme-text-primary text-xl font-semibold">Session Recording</p>
              <p className="theme-text-muted mt-2 text-sm">
                Replay the captured interview video alongside the saved transcript and feedback.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="theme-panel-soft rounded-2xl p-4 text-center">
                <p className="theme-text-dim text-xs uppercase tracking-wide">Duration</p>
                <p className="theme-text-primary mt-2 text-lg font-semibold">
                  {selectedSession.recording_duration_seconds
                    ? formatDurationSeconds(selectedSession.recording_duration_seconds)
                    : "N/A"}
                </p>
              </div>
              <div className="theme-panel-soft rounded-2xl p-4 text-center">
                <p className="theme-text-dim text-xs uppercase tracking-wide">File Size</p>
                <p className="theme-text-primary mt-2 text-lg font-semibold">
                  {formatFileSize(selectedSession.recording_bytes)}
                </p>
              </div>
              <div className="theme-panel-soft rounded-2xl p-4 text-center">
                <p className="theme-text-dim text-xs uppercase tracking-wide">Format</p>
                <p className="theme-text-primary mt-2 text-lg font-semibold">
                  {selectedSession.recording_mime || "N/A"}
                </p>
              </div>
            </div>
          </div>

          {recordingStatus === "loading" && (
            <div className="theme-panel-soft mt-5 rounded-2xl p-5">
              <p className="theme-text-muted text-sm">Loading the saved recording...</p>
            </div>
          )}

          {recordingStatus === "error" && (
            <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm text-red-100">
                {recordingError ?? "Failed to load the saved session recording."}
              </p>
            </div>
          )}

          {recordingStatus === "idle" && (
            <div className="theme-panel-soft mt-5 rounded-2xl p-5">
              <p className="theme-text-muted text-sm">
                No video recording was saved for this session.
              </p>
            </div>
          )}

          {recordingUrl && recordingStatus === "ready" && (
            <div className="theme-panel-soft mt-5 overflow-hidden rounded-2xl">
              <video
                className="aspect-video w-full bg-black object-contain"
                controls
                preload="metadata"
                src={recordingUrl}
              />
            </div>
          )}
        </section>

        <AccountFeedbackSection
          title="Speech Feedback"
          accent="bg-emerald-500/15 text-emerald-100"
          payload={selectedSession.speech_feedback as FeedbackPayload}
        />
        <AccountFeedbackSection
          title="Video Feedback"
          accent="bg-sky-500/15 text-sky-100"
          payload={selectedSession.video_feedback as FeedbackPayload}
        />
      </div>

      <section className="theme-panel rounded-3xl p-6">
        <p className="theme-text-primary text-xl font-semibold">Generated Questions</p>
        {selectedSession.questions?.length ? (
          <div className="mt-4 space-y-3">
            {selectedSession.questions.map((item, index) => (
              <div key={`${item.question}-${index}`} className="theme-panel-soft rounded-2xl p-4">
                <p className="theme-text-dim text-xs uppercase tracking-[0.2em]">
                  {item.category || `Question ${index + 1}`}
                </p>
                <p className="theme-text-primary mt-2 text-base font-semibold leading-7">
                  {item.question}
                </p>
                {item.rationale && (
                  <p className="theme-text-muted mt-2 text-sm leading-6">{item.rationale}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="theme-text-muted mt-3 text-sm">
            No generated questions were saved for this session.
          </p>
        )}
      </section>

      <section className="theme-panel rounded-3xl p-6">
        <p className="theme-text-primary text-xl font-semibold">Answers By Question</p>
        {transcriptReview?.approximate && (
          <div className="mt-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4">
            <p className="text-sm text-yellow-100">
              This older session did not save question-level answers directly. The paragraphs below
              are grouped from final transcript segments and matched to questions in order.
            </p>
          </div>
        )}
        {transcriptReview && transcriptReview.sections.length > 0 ? (
          <div className="mt-4 space-y-4">
            {transcriptReview.sections.map((section) => (
              <div key={section.key} className="theme-panel-soft rounded-2xl p-5">
                <p className="theme-text-dim text-xs uppercase tracking-[0.2em]">{section.label}</p>
                {section.question && (
                  <p className="theme-text-primary mt-2 text-base font-semibold leading-7">
                    {section.question}
                  </p>
                )}
                {section.rationale && (
                  <p className="theme-text-muted mt-2 text-sm leading-6">{section.rationale}</p>
                )}
                {section.timing && (
                  <p className="theme-text-dim mt-3 text-xs uppercase tracking-[0.18em]">
                    {section.timing}
                  </p>
                )}
                <div className="theme-border mt-4 border-t pt-4">
                  <p className="theme-text-dim text-xs uppercase tracking-[0.2em]">Answer</p>
                  <p className="theme-text-secondary mt-2 whitespace-pre-line text-sm leading-7">
                    {section.answer || "No answer was captured for this question."}
                  </p>
                  {section.answerReview && (
                    <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="theme-text-dim text-xs uppercase tracking-[0.2em]">
                            Response Review
                          </p>
                          <p className="theme-text-primary mt-2 text-sm font-semibold">
                            {section.answerReview.summary}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="theme-text-dim text-xs uppercase tracking-[0.18em]">
                            Score
                          </p>
                          <p className="theme-text-primary mt-2 text-lg font-semibold">
                            {section.answerReview.score.toFixed(1)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 md:grid-cols-4">
                        {Object.entries(section.answerReview.dimension_scores).map(
                          ([label, value]) => (
                            <div
                              key={`${section.key}-${label}`}
                              className="rounded-xl border border-white/8 bg-black/10 px-3 py-2"
                            >
                              <p className="theme-text-dim text-[11px] uppercase tracking-wide">
                                {label}
                              </p>
                              <p className="theme-text-primary mt-1 text-sm font-semibold">
                                {value.toFixed(1)}
                              </p>
                            </div>
                          )
                        )}
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="theme-text-dim text-xs uppercase tracking-[0.2em]">
                            Strengths
                          </p>
                          <ul className="theme-text-secondary mt-2 space-y-2 text-sm">
                            {section.answerReview.strengths.map((item, index) => (
                              <li key={`${section.key}-strength-${index}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="theme-text-dim text-xs uppercase tracking-[0.2em]">
                            Improve Next
                          </p>
                          <ul className="theme-text-secondary mt-2 space-y-2 text-sm">
                            {section.answerReview.improvements.map((item, index) => (
                              <li key={`${section.key}-improve-${index}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                  {section.transcriptSegments.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="theme-text-dim text-xs uppercase tracking-[0.2em]">
                        Final transcript segments
                      </p>
                      {section.transcriptSegments.map((segment, segmentIndex) => (
                        <div
                          key={`${section.key}-segment-${segmentIndex}`}
                          className="rounded-xl border border-white/8 bg-black/10 px-3 py-2"
                        >
                          <p className="theme-text-secondary text-sm leading-6">{segment.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="theme-text-muted mt-3 text-sm">No transcript was saved for this session.</p>
        )}
      </section>
    </div>
  );
};

export default AccountSessionDetails;
