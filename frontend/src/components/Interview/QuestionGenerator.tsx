import { useEffect, useMemo, useRef, useState } from "react";
import { fetchWithLoopbackFallback, getApiBase } from "../../network";
import type { GeneratedQuestion } from "./types";

type QuestionGeneratorProps = {
  apiBase?: string;
  endpointPath?: string;
  onQuestions?: (questions: GeneratedQuestion[], raw: unknown) => void;
  onAnswersChange?: (answers: Array<{ index: number; text: string }>) => void;
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

const defaultApiBase = getApiBase();

export default function QuestionGenerator({
  apiBase = defaultApiBase,
  endpointPath = "/questions/generate",
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
  const [callType, setCallType] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [usedInputs, setUsedInputs] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rawResponse, setRawResponse] = useState<unknown>(null);
  const [interviewStatus, setInterviewStatus] = useState<"idle" | "running" | "ended">("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<{ index: number; text: string }>>([]);
  const [nowMs, setNowMs] = useState<number | null>(null);

  const sessionStartRef = useRef<number | null>(null);
  const questionStartRef = useRef<number | null>(null);
  const transcriptStartIndexRef = useRef<number>(0);
  const startSignalRef = useRef<number | null>(null);

  

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

  const sortQuestions = (items: GeneratedQuestion[]) => {
    return items
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const aIsBehavioral = (a.item.category ?? "").toLowerCase() === "behavioral";
        const bIsBehavioral = (b.item.category ?? "").toLowerCase() === "behavioral";
        if (aIsBehavioral === bIsBehavioral) return a.index - b.index;
        return aIsBehavioral ? -1 : 1;
      })
      .map((entry) => entry.item);
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
    onInputChange?.({ role, company, callType });
  }, [role, company, callType, onInputChange]);

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
    const answerText = currentAnswerText || "—";
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = { index: currentIndex, text: answerText };
      return next;
    });
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

  const goToNextQuestion = () => {
    finalizeAnswer();
    const nextIndex = currentIndex + 1;
    if (nextIndex >= questions.length) {
      endInterview();
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
      setError("Add a role to generate questions.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setQuestions([]);
    setUsedInputs([]);
    setWarnings([]);
    setRawResponse(null);
    setInterviewStatus("idle");

    const payload = {
      role: role.trim() || undefined,
      company: company.trim() || undefined,
      call_type: callType.trim() || undefined,
    };

    try {
      const response = await fetchWithLoopbackFallback(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });


      

      if (!response.ok) {
        throw new Error(`Question generation failed (${response.status})`);
      }

      const data = (await response.json()) as QuestionResponse;
      const extracted = extractQuestions(data);
      setQuestions(sortQuestions(extracted));
      setUsedInputs(Array.isArray(data?.used_inputs) ? data.used_inputs : []);
      setWarnings(Array.isArray(data?.warnings) ? data.warnings : []);
      setRawResponse(data);
      onQuestions?.(extracted, data);
    } catch (err: any) {
      if (err instanceof TypeError) {
        setError(
          `Unable to reach the question API at ${endpoint}. Make sure the backend is running and that VITE_API_BASE points to the correct host.`
        );
      } else {
        setError(err?.message ?? "Failed to generate questions.");
      }
    } finally {
      setIsLoading(false);
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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="theme-text-primary text-lg font-semibold">Question Generator</h2>
          <p className="theme-text-muted text-xs">
            Generate tailored questions for interviews, sales calls, or presentations.
          </p>
        </div>
     
      </div>

      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="theme-text-muted text-xs">Role</label>
            <input
              type="text"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder="Account Executive"
              className="theme-input mt-1 w-full rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="theme-text-muted text-xs">Company</label>
            <input
              type="text"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="Acme Inc."
              className="theme-input mt-1 w-full rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="theme-text-muted text-xs">Interview or call type</label>
          <input
            type="text"
            value={callType}
            onChange={(event) => setCallType(event.target.value)}
            placeholder="Panel interview, discovery call, demo presentation"
            className="theme-input mt-1 w-full rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isLoading}
          className={`flex-1 px-4 py-2.5 rounded-lg font-semibold transition ${
            isLoading
              ? "theme-button-secondary cursor-not-allowed opacity-60"
              : "theme-button-primary"
          }`}
        >
          {isLoading ? "Generating..." : "Generate Questions"}
        </button>
        <button
          type="button"
          onClick={() => {
            setRole("");
            setCompany("");
            setCallType("");
            setQuestions([]);
            setUsedInputs([]);
            setWarnings([]);
            setRawResponse(null);
            setError(null);
            setInterviewStatus("idle");
            setAnswers([]);
          }}
          className="theme-button-secondary rounded-lg px-4 py-2.5 text-sm"
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
                <div className="flex items-center justify-between mb-2">
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
                      onClick={goToNextQuestion}
                      className="theme-button-primary flex-1 rounded-lg px-3 py-2 text-sm font-semibold"
                    >
                      {currentIndex + 1 < questions.length ? "Next question" : "Finish interview"}
                    </button>
                    <button
                      type="button"
                      onClick={endInterview}
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
                        <p className="theme-text-secondary text-sm">{answer.text}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) 
        
        : rawResponse ? (
          <pre className="text-xs text-gray-300 whitespace-pre-wrap">
            {JSON.stringify(rawResponse, null, 2)}
          </pre>
        ) : (
          <p className="theme-text-dim text-sm">
            Add a role, company, or call type to generate a tailored question set.
          </p>
        )
        
        }
      </div>
    </div>
  );
}
