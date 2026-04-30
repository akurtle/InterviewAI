import type { QuestionResponseReview } from "./interview";

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
  answerReview: QuestionResponseReview | null;
};

export type AccountTranscriptReview = {
  approximate: boolean;
  sections: AccountAnswerSection[];
};
