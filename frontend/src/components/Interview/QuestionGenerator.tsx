import { useEffect, useMemo, useRef, useState } from "react";
import { fetchWithLoopbackFallback, getApiBase } from "../../network";
import type { GeneratedQuestion, QuestionAnswerReview } from "./types";

type SessionType = "interview" | "pitch";

type QuestionGeneratorProps = {
  apiBase?: string;
  endpointPath?: string;
  sessionType?: SessionType;
  onQuestions?: (questions: GeneratedQuestion[], raw: unknown) => void;
  onAnswersChange?: (answers: QuestionAnswerReview[]) => void;
  onInputChange?: (inputs: { role: string; company: string; callType: string }) => void;
  transcripts?: Array<{ text: string; isFinal: boolean; ts: number }>;
  startSignal?: number;
  onCurrentQuestionChange?: (question: GeneratedQuestion | null, index: number, total: number) => void;
};

type QuestionResponse = {
  questions?: Array<string | GeneratedQuestion>;
  items?: Array<string | GeneratedQuestion>;
  used_inputs?: string[];
  warnings?: string[];
  data?: {
    questions?: Array<string | GeneratedQuestion>;
  };
};

type QuestionRequestPayload = {
  role?: string;
  company?: string;
  call_type: string;
};

type ContextPreset = {
  value: string;
  label: string;
  description: string;
};

const defaultApiBase = getApiBase();
const TARGET_QUESTION_COUNT = 10;

const INTERVIEW_PRESETS: ContextPreset[] = [
  {
    value: "behavioral_interview",
    label: "Behavioral Interview",
    description: "Practice story-driven answers about teamwork, ownership, and impact.",
  },
  {
    value: "technical_interview",
    label: "Technical Interview",
    description: "Prepare for architecture, debugging, and implementation-style questions.",
  },
  {
    value: "hiring_manager_interview",
    label: "Hiring Manager Interview",
    description: "Focus on role fit, priorities, and how you would add value quickly.",
  },
  {
    value: "panel_interview",
    label: "Panel Interview",
    description: "Train for mixed stakeholder questions and switching context smoothly.",
  },
];

const PITCH_PRESETS: ContextPreset[] = [
  {
    value: "sales_pitch",
    label: "Sales Pitch",
    description: "Practice positioning, value articulation, and objection handling.",
  },
  {
    value: "product_demo",
    label: "Product Demo",
    description: "Rehearse a walkthrough that ties features back to outcomes.",
  },
  {
    value: "stakeholder_presentation",
    label: "Stakeholder Presentation",
    description: "Prepare for a structured presentation with strategic questions.",
  },
  {
    value: "investor_pitch",
    label: "Investor Pitch",
    description: "Focus on traction, market story, and high-stakes follow-up questions.",
  },
];

const getPresetsForSession = (sessionType: SessionType) =>
  sessionType === "pitch" ? PITCH_PRESETS : INTERVIEW_PRESETS;

const getDefaultCallType = (sessionType: SessionType) =>
  getPresetsForSession(sessionType)[0]?.value ?? "interview";

const getCallTypeLabel = (sessionType: SessionType, callType: string) =>
  getPresetsForSession(sessionType).find((preset) => preset.value === callType)?.label ??
  (sessionType === "pitch" ? "Pitch Session" : "Interview");

export default function QuestionGenerator({
  apiBase = defaultApiBase,
  endpointPath = "/questions/generate",
  sessionType = "interview",
  onQuestions,
  onAnswersChange,
  onInputChange,
  transcripts,
  startSignal,
  onCurrentQuestionChange,
}: QuestionGeneratorProps) {
  const endpoint = useMemo(() => `${apiBase}${endpointPath}`, [apiBase, endpointPath]);
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [callType, setCallType] = useState(getDefaultCallType(sessionType));
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFetchingNextQuestion, setIsFetchingNextQuestion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [usedInputs, setUsedInputs] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rawResponse, setRawResponse] = useState<unknown>(null);
  const [generationContext, setGenerationContext] = useState<QuestionRequestPayload | null>(null);
  const [interviewStatus, setInterviewStatus] = useState<"idle" | "running" | "ended">("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<QuestionAnswerReview[]>([]);
  const [nowMs, setNowMs] = useState<number | null>(null);

  const sessionStartRef = useRef<number | null>(null);
  const questionStartRef = useRef<number | null>(null);
  const transcriptStartIndexRef = useRef<number>(0);
  const startSignalRef = useRef<number | null>(null);
  const contextPresets = useMemo(() => getPresetsForSession(sessionType), [sessionType]);
  const currentPreset =
    contextPresets.find((preset) => preset.value === callType) ?? contextPresets[0];
  const roleLabel = sessionType === "pitch" ? "What are you pitching?" : "Target role";
  const companyLabel = sessionType === "pitch" ? "Audience or company" : "Company";
  const rolePlaceholder =
    sessionType === "pitch" ? "AI interview copilot for recruiting teams" : "Senior Frontend Engineer";
  const companyPlaceholder =
    sessionType === "pitch" ? "Hiring leaders at growth-stage startups" : "Acme Inc.";
  const generatorTitle = sessionType === "pitch" ? "Pitch Generator" : "Question Generator";
  const generatorSubtitle =
    sessionType === "pitch"
      ? "Build a tailored practice session that generates one prompt at a time."
      : "Build a tailored practice session that generates one question at a time.";
  const isBusy = isGenerating || isFetchingNextQuestion;
  const inputsLocked = questions.length > 0 || isBusy || interviewStatus !== "idle";
  const canRequestAnotherQuestion =
    generationContext !== null && questions.length < TARGET_QUESTION_COUNT;

  const normalizeItem = (item: string | GeneratedQuestion): GeneratedQuestion | null => {
    if (typeof item === "string") {
      return { question: item };
    }
    if (item && typeof item === "object" && typeof item.question === "string") {
      return {
        question: item.question,
        category: item.category ?? null,
        rationale: item.rationale ?? null,
      };
    }
    return null;
  };

  const extractQuestions = (data: QuestionResponse | string[] | unknown): GeneratedQuestion[] => {
    if (Array.isArray(data)) {
      return data
        .map(normalizeItem)
        .filter((item): item is GeneratedQuestion => Boolean(item));
    }
    if (data && typeof data === "object") {
      const obj = data as QuestionResponse;
      if (Array.isArray(obj.questions)) {
        return obj.questions
          .map(normalizeItem)
          .filter((item): item is GeneratedQuestion => Boolean(item));
      }
      if (Array.isArray(obj.items)) {
        return obj.items
          .map(normalizeItem)
          .filter((item): item is GeneratedQuestion => Boolean(item));
      }
      if (obj.data && Array.isArray(obj.data.questions)) {
        return obj.data.questions
          .map(normalizeItem)
          .filter((item): item is GeneratedQuestion => Boolean(item));
      }
    }
    return [];
  };

  const normalizeCategory = (value?: string | null) => {
    if (!value) return "general";
    return value.toLowerCase().trim().replace(/\s+/g, "_");
  };

  const formatCategoryLabel = (value: string) => {
    if (value === "general") return "General";
    return value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const groupedQuestions = useMemo(() => {
    const map = new Map<string, Array<{ item: GeneratedQuestion; index: number }>>();
    questions.forEach((item, index) => {
      const key = normalizeCategory(item.category);
      const list = map.get(key) ?? [];
      list.push({ item, index });
      map.set(key, list);
    });

    const order = ["behavioral", "system_design", "technical"];
    const extras = Array.from(map.keys())
      .filter((key) => !order.includes(key))
      .sort((a, b) => a.localeCompare(b));

    return [...order, ...extras]
      .filter((key) => map.has(key))
      .map((key) => ({
        key,
        label: formatCategoryLabel(key),
        items: map.get(key) ?? [],
      }));
  }, [questions]);

  useEffect(() => {
    if (!contextPresets.some((preset) => preset.value === callType)) {
      setCallType(getDefaultCallType(sessionType));
    }
  }, [callType, contextPresets, sessionType]);

  useEffect(() => {
    onInputChange?.({ role, company, callType: getCallTypeLabel(sessionType, callType) });
  }, [role, company, callType, onInputChange, sessionType]);

  useEffect(() => {
    onAnswersChange?.(answers);
  }, [answers, onAnswersChange]);

  useEffect(() => {
    if (interviewStatus !== "running") return;
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [interviewStatus]);

  useEffect(() => {
    if (startSignal === undefined || startSignal === null) return;
    if (startSignalRef.current === startSignal) return;
    startSignalRef.current = startSignal;
    if (interviewStatus !== "running") {
      startInterview();
    }
  }, [startSignal, interviewStatus]);

  const currentQuestion = questions[currentIndex];
  useEffect(() => {
    if (interviewStatus !== "running" || !currentQuestion) {
      onCurrentQuestionChange?.(null, 0, questions.length);
      return;
    }
    onCurrentQuestionChange?.(currentQuestion, currentIndex, questions.length);
  }, [interviewStatus, currentQuestion, currentIndex, questions.length, onCurrentQuestionChange]);

  const formatElapsed = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const transcriptSlice = (transcripts ?? [])
    .slice(transcriptStartIndexRef.current)
    .filter((item) => item.isFinal);
  const currentAnswerText = transcriptSlice.map((item) => item.text).join(" ").trim();

  const totalElapsedMs =
    interviewStatus === "running" && nowMs && sessionStartRef.current
      ? nowMs - sessionStartRef.current
      : 0;
  const questionElapsedMs =
    interviewStatus === "running" && nowMs && questionStartRef.current
      ? nowMs - questionStartRef.current
      : 0;

  const finalizeAnswer = () => {
    if (!currentQuestion) return;
    const answerText = currentAnswerText || "--";
    const startedAtMs = questionStartRef.current;
    const endedAtMs =
      transcriptSlice.length > 0
        ? transcriptSlice[transcriptSlice.length - 1]?.ts ?? Date.now()
        : Date.now();
    const durationSeconds =
      startedAtMs && endedAtMs && endedAtMs >= startedAtMs
        ? Math.max(0, Math.round((endedAtMs - startedAtMs) / 1000))
        : null;

    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = {
        index: currentIndex,
        answerText,
        startedAtMs,
        endedAtMs,
        durationSeconds,
        transcriptSegments: transcriptSlice.map((item) => ({ ...item })),
      };
      return next;
    });
  };

  const resetInterviewState = () => {
    setInterviewStatus("idle");
    setCurrentIndex(0);
    setAnswers([]);
    setNowMs(null);
    sessionStartRef.current = null;
    questionStartRef.current = null;
    transcriptStartIndexRef.current = 0;
  };

  const requestQuestions = async (
    context: QuestionRequestPayload,
    existingQuestions: GeneratedQuestion[]
  ) => {
    const response = await fetchWithLoopbackFallback(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...context,
        num_questions: 1,
        asked_questions: existingQuestions.map((item) => item.question),
      }),
    });

    if (!response.ok) {
      throw new Error(`Question generation failed (${response.status})`);
    }

    const data = (await response.json()) as QuestionResponse;
    const extracted = extractQuestions(data);

    return { data, extracted };
  };

  const loadNextQuestion = async (
    context: QuestionRequestPayload,
    existingQuestions: GeneratedQuestion[]
  ) => {
    try {
      const { data, extracted } = await requestQuestions(context, existingQuestions);
      const nextQuestions = extracted.length > 0 ? [...existingQuestions, ...extracted] : existingQuestions;
      setQuestions(nextQuestions);
      setUsedInputs(Array.isArray(data?.used_inputs) ? data.used_inputs : []);
      setWarnings(Array.isArray(data?.warnings) ? data.warnings : []);
      setRawResponse(data);
      onQuestions?.(nextQuestions, data);
      return nextQuestions;
    } catch (err: unknown) {
      if (err instanceof TypeError) {
        setError(
          `Unable to reach the question API at ${endpoint}. Make sure the backend is running and that VITE_API_BASE points to the correct host.`
        );
      } else {
        setError(err instanceof Error ? err.message : "Failed to generate the next question.");
      }
      return undefined;
    }
  };

  const startInterview = () => {
    if (questions.length === 0) {
      setError("Generate questions before starting the interview.");
      return;
    }
    setError(null);
    setInterviewStatus("running");
    setCurrentIndex(0);
    setAnswers([]);
    sessionStartRef.current = Date.now();
    questionStartRef.current = Date.now();
    transcriptStartIndexRef.current = (transcripts ?? []).length;
  };

  const goToNextQuestion = async () => {
    finalizeAnswer();
    const nextIndex = currentIndex + 1;
    if (nextIndex >= questions.length) {
      if (!generationContext || !canRequestAnotherQuestion) {
        endInterview();
        return;
      }

      setError(null);
      setIsFetchingNextQuestion(true);
      const nextQuestions = await loadNextQuestion(generationContext, questions);
      setIsFetchingNextQuestion(false);

      if (nextQuestions === undefined) {
        return;
      }

      if (nextQuestions.length <= nextIndex) {
        endInterview();
        return;
      }

      setCurrentIndex(nextIndex);
      questionStartRef.current = Date.now();
      transcriptStartIndexRef.current = (transcripts ?? []).length;
      return;
    }
    setCurrentIndex(nextIndex);
    questionStartRef.current = Date.now();
    transcriptStartIndexRef.current = (transcripts ?? []).length;
  };

  const endInterview = () => {
    finalizeAnswer();
    setInterviewStatus("ended");
    questionStartRef.current = null;
  };

  const handleGenerate = async () => {
    if (!role.trim()) {
      setError(
        sessionType === "pitch"
          ? "Add what you want to pitch before generating prompts."
          : "Add a target role before generating questions."
      );
      return;
    }

    const nextContext: QuestionRequestPayload = {
      role: role.trim() || undefined,
      company: company.trim() || undefined,
      call_type: getCallTypeLabel(sessionType, callType),
    };

    setIsGenerating(true);
    setError(null);
    setQuestions([]);
    setUsedInputs([]);
    setWarnings([]);
    setRawResponse(null);
    setGenerationContext(nextContext);
    onQuestions?.([], null);
    resetInterviewState();

    try {
      const { data, extracted } = await requestQuestions(nextContext, []);
      setQuestions(extracted);
      setUsedInputs(Array.isArray(data?.used_inputs) ? data.used_inputs : []);
      setWarnings(Array.isArray(data?.warnings) ? data.warnings : []);
      setRawResponse(data);
      onQuestions?.(extracted, data);
      if (extracted.length === 0) {
        setError(
          sessionType === "pitch"
            ? "The API did not return a prompt. Try adjusting the pitch brief and regenerate."
            : "The API did not return a question. Try adjusting the interview brief and regenerate."
        );
      }
    } catch (err: unknown) {
      if (err instanceof TypeError) {
        setError(
          `Unable to reach the question API at ${endpoint}. Make sure the backend is running and that VITE_API_BASE points to the correct host.`
        );
      } else {
        setError(err instanceof Error ? err.message : "Failed to generate questions.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const removeQuestionAt = (removeIndex: number) => {
    setQuestions((prev) => {
      const next = prev.filter((_, idx) => idx !== removeIndex);
      if (next.length === 0) {
        setInterviewStatus("idle");
        setCurrentIndex(0);
        setAnswers([]);
        setNowMs(null);
        sessionStartRef.current = null;
        questionStartRef.current = null;
        transcriptStartIndexRef.current = 0;
        onCurrentQuestionChange?.(null, 0, 0);
        return next;
      }

      setAnswers((prevAnswers) =>
        prevAnswers
          .filter((answer) => answer.index !== removeIndex)
          .map((answer) =>
            answer.index > removeIndex
              ? { ...answer, index: answer.index - 1 }
              : answer
          )
      );

      if (removeIndex < currentIndex) {
        setCurrentIndex((prevIndex) => Math.max(0, prevIndex - 1));
      } else if (removeIndex === currentIndex) {
        const nextIndex = Math.min(currentIndex, next.length - 1);
        setCurrentIndex(nextIndex);
        questionStartRef.current = Date.now();
        transcriptStartIndexRef.current = (transcripts ?? []).length;
        if (interviewStatus === "running" && nextIndex >= next.length) {
          endInterview();
        }
      }

      return next;
    });
  };

  return (
    <div className="theme-panel rounded-2xl p-6 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="theme-text-primary text-lg font-semibold">{generatorTitle}</h2>
          <p className="theme-text-muted text-xs">{generatorSubtitle}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="theme-panel-soft rounded-2xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="theme-text-primary text-sm font-semibold">
                {sessionType === "pitch" ? "Pitch Brief" : "Interview Brief"}
              </p>
              <p className="theme-text-muted mt-1 text-xs">
                {sessionType === "pitch"
                  ? "This section now adapts to the pitch format selected at the start."
                  : "This section now adapts to the interview format selected at the start."}
              </p>
            </div>
            <span className="theme-chip rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em]">
              {sessionType}
            </span>
          </div>

          <div className="mt-4 grid gap-2">
            {contextPresets.map((preset) => {
              const isSelected = preset.value === callType;
              return (
                <button
                  key={preset.value}
                  type="button"
                  disabled={inputsLocked}
                  onClick={() => setCallType(preset.value)}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    isSelected ? "theme-choice-active" : "theme-button-secondary"
                  } ${inputsLocked ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <p className="theme-text-primary text-sm font-semibold">{preset.label}</p>
                  <p className="theme-text-muted mt-1 text-xs">{preset.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="theme-text-muted text-xs">{roleLabel}</label>
            <input
              type="text"
              value={role}
              disabled={inputsLocked}
              onChange={(event) => setRole(event.target.value)}
              placeholder={rolePlaceholder}
              className="theme-input mt-1 w-full rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="theme-text-muted text-xs">{companyLabel}</label>
            <input
              type="text"
              value={company}
              disabled={inputsLocked}
              onChange={(event) => setCompany(event.target.value)}
              placeholder={companyPlaceholder}
              className="theme-input mt-1 w-full rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="theme-panel-soft rounded-2xl p-4">
          <p className="theme-text-dim text-xs uppercase tracking-wide">Selected format</p>
          <p className="theme-text-primary mt-2 text-sm font-semibold">{currentPreset?.label}</p>
          <p className="theme-text-muted mt-1 text-xs">{currentPreset?.description}</p>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isBusy}
          className={`flex-1 rounded-lg px-4 py-2.5 font-semibold transition ${
            isBusy
              ? "theme-button-secondary cursor-not-allowed opacity-60"
              : "theme-button-primary"
          }`}
        >
          {isBusy
            ? isFetchingNextQuestion
              ? "Loading next question..."
              : "Generating..."
            : sessionType === "pitch"
              ? "Generate First Prompt"
              : "Generate First Question"}
        </button>
        <button
          type="button"
          onClick={() => {
            setRole("");
            setCompany("");
            setCallType(getDefaultCallType(sessionType));
            setQuestions([]);
            setUsedInputs([]);
            setWarnings([]);
            setRawResponse(null);
            setError(null);
            setGenerationContext(null);
            resetInterviewState();
            onQuestions?.([], null);
          }}
          disabled={isBusy}
          className={`rounded-lg px-4 py-2.5 text-sm ${
            isBusy
              ? "theme-button-secondary cursor-not-allowed opacity-60"
              : "theme-button-secondary"
          }`}
        >
          Reset
        </button>
      </div>

      <div className="mt-5">
        {questions.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="theme-text-dim text-xs uppercase tracking-wide">Generated questions</p>
              {interviewStatus === "idle" && (
                <button
                  type="button"
                  onClick={startInterview}
                  disabled={isBusy}
                  className="theme-chip rounded-lg px-3 py-1.5 text-xs"
                >
                  Start interview
                </button>
              )}
              {interviewStatus === "ended" && (
                <span className="theme-text-muted text-xs">Interview ended</span>
              )}
            </div>
            {(usedInputs.length > 0 || warnings.length > 0) && (
              <div className="theme-text-muted space-y-2 text-xs">
                {usedInputs.length > 0 && (
                  <p>
                    <span className="theme-text-dim">Used inputs:</span>{" "}
                    {usedInputs.join(", ")}
                  </p>
                )}
                {warnings.length > 0 && (
                  <p className="text-yellow-300">
                    Warnings: {warnings.join(", ")}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-3">
              {groupedQuestions.map((group) => (
                <div key={group.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="theme-text-dim text-xs uppercase tracking-wide">
                      {group.label}
                    </p>
                    <span className="theme-text-dim text-xs">{group.items.length} questions</span>
                  </div>
                  <div className="space-y-2">
                    {group.items.map(({ item, index }) => (
                      <div
                        key={`${index}-${item.question.slice(0, 20)}`}
                        className="theme-panel-strong rounded-lg px-3 py-2 text-sm"
                      >
                        <div className="flex items-start gap-2">
                          <span className="theme-accent-text mt-0.5 font-mono text-xs">
                            {index + 1}
                          </span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {item.category && (
                                <span className="theme-chip rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide">
                                  {item.category.replace(/_/g, " ")}
                                </span>
                              )}
                              <span className="theme-text-secondary text-sm">{item.question}</span>
                            </div>
                            {item.rationale && (
                              <p className="theme-text-muted mt-1 text-xs">{item.rationale}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeQuestionAt(index)}
                            className="theme-text-dim text-xs transition hover:text-red-300"
                            aria-label="Remove question"
                            title="Remove question"
                          >
                            x
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {interviewStatus !== "idle" && currentQuestion && (
              <div className="theme-panel-strong mt-4 rounded-lg p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="theme-text-muted text-xs">Current question</p>
                    <p className="theme-text-primary text-sm">
                      {currentIndex + 1}. {currentQuestion.question}
                    </p>
                  </div>
                  <div className="theme-text-muted text-right text-xs">
                    <p>Elapsed: {formatElapsed(totalElapsedMs)}</p>
                    <p>Question: {formatElapsed(questionElapsedMs)}</p>
                  </div>
                </div>

                <div className="theme-panel-soft mt-3 rounded-lg p-3">
                  <p className="theme-text-dim mb-2 text-xs">Live answer transcript</p>
                  <p className="theme-text-secondary text-sm">
                    {currentAnswerText || "Waiting for your response..."}
                  </p>
                </div>

                {interviewStatus === "running" && (
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void goToNextQuestion();
                      }}
                      disabled={isFetchingNextQuestion}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                        isFetchingNextQuestion
                          ? "theme-button-secondary cursor-not-allowed opacity-60"
                          : "theme-button-primary"
                      }`}
                    >
                      {isFetchingNextQuestion
                        ? "Loading next question..."
                        : currentIndex + 1 < questions.length || canRequestAnotherQuestion
                          ? "Next question"
                          : "Finish interview"}
                    </button>
                    <button
                      type="button"
                      onClick={endInterview}
                      disabled={isFetchingNextQuestion}
                      className="theme-button-secondary rounded-lg px-3 py-2 text-sm"
                    >
                      End interview
                    </button>
                  </div>
                )}
              </div>
            )}

            {interviewStatus === "ended" && answers.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="theme-text-dim text-xs uppercase tracking-wide">Answers</p>
                <div className="space-y-2">
                  {answers.map((answer) => {
                    const item = questions[answer.index];
                    if (!item) return null;
                    return (
                      <div
                        key={`answer-${answer.index}`}
                        className="theme-panel-strong rounded-lg p-3"
                      >
                        <p className="theme-text-muted mb-1 text-xs">
                          {answer.index + 1}. {item.question}
                        </p>
                        <p className="theme-text-secondary text-sm">{answer.answerText}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : rawResponse ? (
          <pre className="whitespace-pre-wrap text-xs text-gray-300">
            {JSON.stringify(rawResponse, null, 2)}
          </pre>
        ) : (
          <p className="theme-text-dim text-sm">
            {sessionType === "pitch"
              ? "Choose your pitch format, add the topic and audience, and generate the first tailored prompt."
              : "Choose your interview format, add the role and company, and generate the first tailored question."}
          </p>
        )}
      </div>
    </div>
  );
}
