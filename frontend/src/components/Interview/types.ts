export type RecordMode = "video" | "audio" | "both";
export type FeedbackStatus = "idle" | "loading" | "ready" | "error";

export type GeneratedQuestion = {
  category?: string | null;
  question: string;
  rationale?: string | null;
  answer_text?: string | null;
  answer_started_at?: string | null;
  answer_ended_at?: string | null;
  answer_duration_seconds?: number | null;
  transcript_segments?: TranscriptItem[] | null;
};

export type TranscriptItem = {
  text: string;
  isFinal: boolean;
  ts: number;
};

export type QuestionAnswerReview = {
  index: number;
  answerText: string;
  startedAtMs: number | null;
  endedAtMs: number | null;
  durationSeconds: number | null;
  transcriptSegments: TranscriptItem[];
};

export type VisionFrame = {
  timestamp: number;
  face_present: boolean;
  looking_at_camera: boolean;
  smile_prob?: number | null;
  head_yaw?: number | null;
  head_pitch?: number | null;
};

export type SessionRecording = {
  blob: Blob;
  mimeType: string;
  size: number;
  durationSeconds: number | null;
};
