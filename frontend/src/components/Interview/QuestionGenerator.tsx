import { useEffect, useMemo, useRef, useState } from "react";

type QuestionGeneratorProps = {
  apiBase?: string;
  endpointPath?: string;
  onQuestions?: (questions: QuestionItem[], raw: unknown) => void;
  transcripts?: Array<{ text: string; isFinal: boolean; ts: number }>;
  startSignal?: number;
  onCurrentQuestionChange?: (question: QuestionItem | null, index: number, total: number) => void;
};

type QuestionItem = {
  category?: string | null;
  question: string;
  rationale?: string | null;
};

type QuestionResponse = {
  questions?: Array<string | QuestionItem>;
  items?: Array<string | QuestionItem>;
  used_inputs?: string[];
  warnings?: string[];
  data?: {
    questions?: Array<string | QuestionItem>;
  };
};

const defaultApiBase = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export default function QuestionGenerator({
  apiBase = defaultApiBase,
  endpointPath = "/questions/generate",
  onQuestions,
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
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
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

  

  const normalizeItem = (item: string | QuestionItem): QuestionItem | null => {
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

  const extractQuestions = (data: QuestionResponse | string[] | unknown): QuestionItem[] => {
    if (Array.isArray(data)) {
      return data
        .map(normalizeItem)
        .filter((item): item is QuestionItem => Boolean(item));
    }
    if (data && typeof data === "object") {
      const obj = data as QuestionResponse;
      if (Array.isArray(obj.questions)) {
        return obj.questions
          .map(normalizeItem)
          .filter((item): item is QuestionItem => Boolean(item));
      }
      if (Array.isArray(obj.items)) {
        return obj.items
          .map(normalizeItem)
          .filter((item): item is QuestionItem => Boolean(item));
      }
      if (obj.data && Array.isArray(obj.data.questions)) {
        return obj.data.questions
          .map(normalizeItem)
          .filter((item): item is QuestionItem => Boolean(item));
      }
    }
    return [];
  };

  const sortQuestions = (items: QuestionItem[]) => {
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
    const map = new Map<string, Array<{ item: QuestionItem; index: number }>>();
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
      const response = await fetch(endpoint, {
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
      setError(err?.message ?? "Failed to generate questions.");
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
    <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-white text-lg font-semibold">Question Generator</h2>
          <p className="text-xs text-gray-400">
            Generate tailored questions for interviews, sales calls, or presentations.
          </p>
        </div>
     
      </div>

      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs text-gray-400">Role</label>
            <input
              type="text"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder="Account Executive"
              className="mt-1 w-full rounded-lg border border-gray-800 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-600"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400">Company</label>
            <input
              type="text"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="Acme Inc."
              className="mt-1 w-full rounded-lg border border-gray-800 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-600"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400">Interview or call type</label>
          <input
            type="text"
            value={callType}
            onChange={(event) => setCallType(event.target.value)}
            placeholder="Panel interview, discovery call, demo presentation"
            className="mt-1 w-full rounded-lg border border-gray-800 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-600"
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
              ? "bg-gray-800 text-gray-400 cursor-not-allowed"
              : "bg-emerald-500 hover:bg-emerald-600 text-white"
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
          className="px-4 py-2.5 rounded-lg border border-gray-800 text-sm text-gray-300 hover:bg-gray-900/40 transition"
        >
          Reset
        </button>
      </div>

      <div className="mt-5">
        {questions.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-gray-500">Generated questions</p>
              {interviewStatus === "idle" && (
                <button
                  type="button"
                  onClick={startInterview}
                  className="px-3 py-1.5 rounded-lg border border-emerald-500/40 text-xs text-emerald-300 hover:bg-emerald-500/10 transition"
                >
                  Start interview
                </button>
              )}
              {interviewStatus === "ended" && (
                <span className="text-xs text-gray-400">Interview ended</span>
              )}
            </div>
            {(usedInputs.length > 0 || warnings.length > 0) && (
              <div className="space-y-2 text-xs text-gray-400">
                {usedInputs.length > 0 && (
                  <p>
                    <span className="text-gray-500">Used inputs:</span>{" "}
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
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      {group.label}
                    </p>
                    <span className="text-xs text-gray-500">{group.items.length} questions</span>
                  </div>
                  <div className="space-y-2">
                    {group.items.map(({ item, index }) => (
                      <div
                        key={`${index}-${item.question.slice(0, 20)}`}
                        className="rounded-lg border border-gray-800 bg-black/40 px-3 py-2 text-sm text-gray-200"
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-emerald-400 font-mono text-xs mt-0.5">
                            {index + 1}
                          </span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {item.category && (
                                <span className="text-[10px] uppercase tracking-wide text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                  {item.category.replace(/_/g, " ")}
                                </span>
                              )}
                              <span className="text-sm text-gray-200">{item.question}</span>
                            </div>
                            {item.rationale && (
                              <p className="mt-1 text-xs text-gray-400">{item.rationale}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeQuestionAt(index)}
                            className="text-xs text-gray-500 hover:text-red-300 transition"
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
              <div className="mt-4 rounded-lg border border-gray-800 bg-black/40 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs text-gray-400">Current question</p>
                    <p className="text-sm text-white">
                      {currentIndex + 1}. {currentQuestion.question}
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-400">
                    <p>Elapsed: {formatElapsed(totalElapsedMs)}</p>
                    <p>Question: {formatElapsed(questionElapsedMs)}</p>
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-gray-800 bg-black/50 p-3">
                  <p className="text-xs text-gray-500 mb-2">Live answer transcript</p>
                  <p className="text-sm text-gray-200">
                    {currentAnswerText || "Waiting for your response..."}
                  </p>
                </div>

                {interviewStatus === "running" && (
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={goToNextQuestion}
                      className="flex-1 px-3 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition"
                    >
                      {currentIndex + 1 < questions.length ? "Next question" : "Finish interview"}
                    </button>
                    <button
                      type="button"
                      onClick={endInterview}
                      className="px-3 py-2 rounded-lg border border-gray-800 text-sm text-gray-300 hover:bg-gray-900/40 transition"
                    >
                      End interview
                    </button>
                  </div>
                )}
              </div>
            )}

            {interviewStatus === "ended" && answers.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs uppercase tracking-wide text-gray-500">Answers</p>
                <div className="space-y-2">
                  {answers.map((answer) => {
                    const item = questions[answer.index];
                    if (!item) return null;
                    return (
                      <div
                        key={`answer-${answer.index}`}
                        className="rounded-lg border border-gray-800 bg-black/40 p-3"
                      >
                        <p className="text-xs text-gray-400 mb-1">
                          {answer.index + 1}. {item.question}
                        </p>
                        <p className="text-sm text-gray-200">{answer.text}</p>
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
          <p className="text-sm text-gray-500">
            Add a role, company, or call type to generate a tailored question set.
          </p>
        )
        
        }
      </div>
    </div>
  );
}
