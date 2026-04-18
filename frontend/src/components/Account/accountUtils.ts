import type {
  StoredInterviewSession,
  StoredInterviewSessionAnswer,
} from "../../sessionStore";

export type FeedbackPayload = {
  score?: number | null;
  feedback?: string[];
  warnings?: string[];
  metrics?: Record<string, unknown>;
} | null;

export type AccountAnswerSection = {
  key: string;
  label: string;
  question: string;
  rationale: string | null;
  answer: string;
  timing: string;
  transcriptSegments: Array<{ text: string }>;
};

export type AccountTranscriptReview = {
  approximate: boolean;
  sections: AccountAnswerSection[];
};

export const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

export const formatScore = (value: number | null | undefined) =>
  typeof value === "number" ? value.toFixed(1) : "N/A";

export const formatMetricValue = (value: unknown) => {
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

export const formatLabel = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const getContextFieldLabels = (sessionType: "interview" | "pitch") =>
  sessionType === "pitch"
    ? {
        role: "Pitch Topic",
        company: "Audience / Company",
        callType: "Pitch Format",
      }
    : {
        role: "Role",
        company: "Company",
        callType: "Interview Format",
      };

export const formatDuration = (startedAt: string, endedAt: string) => {
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

export const formatDurationSeconds = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return "N/A";
  }

  if (value < 60) {
    return `${value}s`;
  }

  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

export const formatFileSize = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "N/A";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
};

export const formatAnswerTiming = (
  startedAt: string | null,
  endedAt: string | null,
  durationSeconds: number | null
) => {
  const parts: string[] = [];

  if (startedAt) {
    parts.push(`Started ${formatDateTime(startedAt)}`);
  }
  if (endedAt) {
    parts.push(`Ended ${formatDateTime(endedAt)}`);
  }
  if (typeof durationSeconds === "number" && durationSeconds > 0) {
    parts.push(`${formatDurationSeconds(durationSeconds)} response`);
  }

  return parts.join(" | ");
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

export const buildQuestionAnswerSections = (
  session: StoredInterviewSession,
  answers: StoredInterviewSessionAnswer[]
): AccountTranscriptReview => {
  const questions = session.questions ?? [];
  const blocks = buildApproxAnswerBlocks(session);
  const hasAnswerRows = answers.length > 0;
  const hasSavedAnswers = questions.some(
    (question) => typeof question.answer_text === "string" && question.answer_text.trim()
  );

  if (questions.length === 0) {
    return {
      approximate: !hasAnswerRows,
      sections: hasAnswerRows
        ? answers.map((answer) => ({
            key: answer.id,
            label: `Answer ${answer.position + 1}`,
            question: answer.question_text,
            rationale: answer.question_rationale,
            answer: answer.answer_text ?? "",
            timing: formatAnswerTiming(
              answer.answer_started_at,
              answer.answer_ended_at,
              answer.answer_duration_seconds
            ),
            transcriptSegments: answer.transcript_segments ?? [],
          }))
        : blocks.map((answer, index) => ({
            key: `answer-${index}`,
            label: `Answer ${index + 1}`,
            question: "",
            rationale: null,
            answer,
            timing: "",
            transcriptSegments: [],
          })),
    };
  }

  if (hasAnswerRows) {
    return {
      approximate: false,
      sections: questions.map((question, index) => {
        const answer = answers.find((item) => item.position === index);

        return {
          key: answer?.id ?? `question-${index}`,
          label: `Question ${index + 1}`,
          question: answer?.question_text ?? question.question,
          rationale: answer?.question_rationale ?? question.rationale ?? null,
          answer: answer?.answer_text ?? question.answer_text?.trim() ?? "",
          timing: answer
            ? formatAnswerTiming(
                answer.answer_started_at,
                answer.answer_ended_at,
                answer.answer_duration_seconds
              )
            : "",
          transcriptSegments: answer?.transcript_segments ?? question.transcript_segments ?? [],
        };
      }),
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
      timing: formatAnswerTiming(
        question.answer_started_at ?? null,
        question.answer_ended_at ?? null,
        question.answer_duration_seconds ?? null
      ),
      transcriptSegments: question.transcript_segments ?? [],
    };
  });

  return {
    approximate: !hasSavedAnswers && blocks.length > 0,
    sections,
  };
};
