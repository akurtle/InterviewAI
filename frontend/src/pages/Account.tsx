import { useEffect, useState } from "react";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { useAuth } from "../auth";
import { listInterviewSessions, type StoredInterviewSession } from "../sessionStore";

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

type FeedbackPayload = {
  score?: number | null;
  feedback?: string[];
  warnings?: string[];
  metrics?: Record<string, unknown>;
} | null;

const formatScore = (value: number | null | undefined) =>
  typeof value === "number" ? value.toFixed(1) : "N/A";

const formatMetricValue = (value: unknown) => {
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (value == null) {
    return "N/A";
  }

  return String(value);
};

const formatLabel = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatDuration = (startedAt: string, endedAt: string) => {
  const durationMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return "N/A";
  }

  const totalMinutes = Math.round(durationMs / 60000);
  if (totalMinutes < 1) {
    return "Under 1 min";
  }
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
};

const normalizeTranscriptTimestamp = (value: number) => (value > 1e11 ? value / 1000 : value);

const buildApproxAnswerBlocks = (session: StoredInterviewSession) => {
  const finalTranscripts = (session.transcripts ?? [])
    .filter((item) => item.isFinal && item.text.trim())
    .map((item) => ({
      ...item,
      text: item.text.trim().replace(/\s+/g, " "),
      tsSeconds: normalizeTranscriptTimestamp(item.ts),
    }));

  const blocks: string[] = [];
  let currentBlock: string[] = [];
  let previousTs: number | null = null;

  for (const item of finalTranscripts) {
    const currentText = currentBlock.join(" ");
    const gapSeconds = previousTs == null ? 0 : item.tsSeconds - previousTs;
    const shouldSplit =
      currentBlock.length > 0 && (gapSeconds >= 18 || currentText.length >= 480);

    if (shouldSplit) {
      blocks.push(currentText);
      currentBlock = [item.text];
    } else {
      currentBlock.push(item.text);
    }

    previousTs = item.tsSeconds;
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join(" "));
  }

  return blocks;
};

const buildQuestionAnswerSections = (session: StoredInterviewSession) => {
  const questions = session.questions ?? [];
  const blocks = buildApproxAnswerBlocks(session);
  const hasSavedAnswers = questions.some(
    (question) => typeof question.answer_text === "string" && question.answer_text.trim()
  );

  if (questions.length === 0) {
    return {
      approximate: true,
      sections: blocks.map((answer, index) => ({
        key: `answer-${index}`,
        label: `Answer ${index + 1}`,
        question: "",
        rationale: null,
        answer,
      })),
    };
  }

  const sections = questions.map((question, index) => {
    let answer = question.answer_text?.trim() ?? "";

    if (!answer && !hasSavedAnswers) {
      if (blocks.length <= questions.length) {
        answer = blocks[index] ?? "";
      } else {
        const start = Math.floor((index * blocks.length) / questions.length);
        const end = Math.floor(((index + 1) * blocks.length) / questions.length);
        answer = blocks.slice(start, Math.max(start + 1, end)).join("\n\n");
      }
    }

    return {
      key: `question-${index}`,
      label: `Question ${index + 1}`,
      question: question.question,
      rationale: question.rationale ?? null,
      answer,
    };
  });

  return {
    approximate: !hasSavedAnswers && blocks.length > 0,
    sections,
  };
};

function FeedbackSection({
  title,
  accent,
  payload,
}: {
  title: string;
  accent: string;
  payload: FeedbackPayload;
}) {
  if (!payload) {
    return (
      <section className="theme-panel rounded-3xl p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="theme-text-primary text-xl font-semibold">{title}</p>
            <p className="theme-text-muted mt-2 text-sm">No saved feedback for this session.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${accent}`}>
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
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${accent}`}>
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
              <p className="theme-text-primary mt-2 text-lg font-semibold">{formatMetricValue(value)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Account() {
  const { user, signOut, isConfigured } = useAuth();
  const [sessions, setSessions] = useState<StoredInterviewSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured || !user) {
      setStatus("ready");
      return;
    }

    let cancelled = false;

    void listInterviewSessions()
      .then((rows) => {
        if (cancelled) return;
        setSessions(rows);
        setSelectedSessionId((current) => current ?? rows[0]?.id ?? null);
        setStatus("ready");
      })
      .catch((nextError: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setError(nextError instanceof Error ? nextError.message : "Failed to load saved sessions.");
      });

    return () => {
      cancelled = true;
    };
  }, [isConfigured, user]);

  const selectedSession =
    sessions.find((session) => session.id === selectedSessionId) ?? sessions[0] ?? null;
  const transcriptReview = selectedSession ? buildQuestionAnswerSections(selectedSession) : null;

  return (
    <div className="theme-page-shell">
      <Navbar />

      <section className="relative overflow-hidden px-6 pb-20 pt-32">
        <div className="theme-grid-overlay absolute inset-0 opacity-70" />
        <div className="absolute inset-0 opacity-35">
          <div className="theme-glow-primary absolute left-[10%] top-[16%] h-72 w-72 rounded-full blur-3xl" />
          <div className="theme-glow-secondary absolute bottom-[10%] right-[10%] h-72 w-72 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl">
          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="theme-accent-text text-sm uppercase tracking-[0.24em]">User Page</p>
              <h1 className="theme-text-primary mt-3 text-4xl font-bold md:text-5xl">
                Past session feedback
              </h1>
              <p className="theme-text-muted mt-3 max-w-2xl text-base">
                {user?.email
                  ? `Signed in as ${user.email}. Review prior interview and pitch sessions, including transcripts and feedback.`
                  : "Sign in to review stored interview history."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void signOut()}
              className="theme-button-secondary rounded-xl px-4 py-2 text-sm font-medium"
            >
              Sign out
            </button>
          </div>

          {!isConfigured && (
            <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4">
              <p className="text-sm text-yellow-100">
                Supabase is not configured. Add the frontend env vars and run the schema in `supabase/schema.sql`.
              </p>
            </div>
          )}

          {status === "loading" && (
            <div className="theme-panel rounded-2xl p-6">
              <p className="theme-text-primary font-semibold">Loading sessions</p>
              <p className="theme-text-muted mt-2 text-sm">Fetching your saved interview history from Supabase.</p>
            </div>
          )}

          {status === "error" && error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm text-red-100">{error}</p>
            </div>
          )}

          {status === "ready" && sessions.length === 0 && (
            <div className="theme-panel rounded-2xl p-8">
              <p className="theme-text-primary text-lg font-semibold">No saved sessions yet</p>
              <p className="theme-text-muted mt-2 text-sm">
                Finish a mock interview or pitch session while signed in and it will appear here automatically.
              </p>
            </div>
          )}

          {sessions.length > 0 && (
            <div className="grid gap-6 xl:grid-cols-[360px,minmax(0,1fr)]">
              <aside className="space-y-4">
                {sessions.map((session) => {
                  const isSelected = session.id === selectedSession?.id;

                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => setSelectedSessionId(session.id)}
                      className={`theme-panel block w-full rounded-3xl p-5 text-left transition ${
                        isSelected ? "ring-2 ring-[var(--theme-accent)]" : "hover:-translate-y-0.5"
                      }`}
                    >
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div>
                          <p className="theme-text-primary text-lg font-semibold">
                            {session.session_type === "pitch" ? "Pitch practice" : "Interview practice"}
                          </p>
                          <p className="theme-text-muted mt-1 text-sm">
                            {formatDateTime(session.created_at)}
                          </p>
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
                        <p className="theme-text-secondary text-sm">
                          {session.question_context?.role || "General practice"}
                        </p>
                        <p className="theme-text-muted mt-1 text-xs uppercase tracking-[0.18em]">
                          {formatDuration(session.started_at, session.ended_at)} session
                        </p>
                      </div>
                    </button>
                  );
                })}
              </aside>

              {selectedSession && (
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
                          {formatDateTime(selectedSession.created_at)} • {formatDuration(selectedSession.started_at, selectedSession.ended_at)}
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
                        <p className="theme-text-dim text-xs uppercase tracking-wide">Company</p>
                        <p className="theme-text-primary mt-2 text-lg font-semibold">
                          {selectedSession.question_context?.company || "N/A"}
                        </p>
                      </div>
                      <div className="theme-panel-soft rounded-2xl p-4">
                        <p className="theme-text-dim text-xs uppercase tracking-wide">Call Type</p>
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
                    <FeedbackSection
                      title="Speech Feedback"
                      accent="bg-emerald-500/15 text-emerald-100"
                      payload={selectedSession.speech_feedback as FeedbackPayload}
                    />
                    <FeedbackSection
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
                      <p className="theme-text-muted mt-3 text-sm">No generated questions were saved for this session.</p>
                    )}
                  </section>

                  <section className="theme-panel rounded-3xl p-6">
                    <p className="theme-text-primary text-xl font-semibold">Answers By Question</p>
                    {transcriptReview?.approximate && (
                      <div className="mt-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4">
                        <p className="text-sm text-yellow-100">
                          This older session did not save question-level answers directly. The paragraphs below are grouped from final transcript segments and matched to questions in order.
                        </p>
                      </div>
                    )}
                    {transcriptReview && transcriptReview.sections.length > 0 ? (
                      <div className="mt-4 space-y-4">
                        {transcriptReview.sections.map((section) => (
                          <div key={section.key} className="theme-panel-soft rounded-2xl p-5">
                            <p className="theme-text-dim text-xs uppercase tracking-[0.2em]">
                              {section.label}
                            </p>
                            {section.question && (
                              <p className="theme-text-primary mt-2 text-base font-semibold leading-7">
                                {section.question}
                              </p>
                            )}
                            {section.rationale && (
                              <p className="theme-text-muted mt-2 text-sm leading-6">
                                {section.rationale}
                              </p>
                            )}
                            <div className="theme-border mt-4 border-t pt-4">
                              <p className="theme-text-dim text-xs uppercase tracking-[0.2em]">
                                Answer
                              </p>
                              <p className="theme-text-secondary mt-2 whitespace-pre-line text-sm leading-7">
                                {section.answer || "No answer was captured for this question."}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="theme-text-muted mt-3 text-sm">No transcript was saved for this session.</p>
                    )}
                  </section>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
