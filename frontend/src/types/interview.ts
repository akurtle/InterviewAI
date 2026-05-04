export type SessionType = "interview" | "pitch";

export type RecordMode = "video" | "audio" | "both";
export type FeedbackStatus = "idle" | "loading" | "ready" | "error";
export type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

export type CallEnvironmentId =
  | "teams"
  | "meet"
  | "audience"
  | "webinar"
  | "studio";

export type CallEnvironmentPreset = {
  id: CallEnvironmentId;
  label: string;
  shortLabel: string;
  description: string;
  helperText: string;
  stageLayout: "platform" | "audience";
  stageHeading: string;
  stageSubheading: string;
  idleTitle: string;
  idleBody: string;
  accentClassName: string;
  shellClassName: string;
  frameClassName: string;
  controlClassName: string;
};

export type QuestionResponseReview = {
  index: number;
  question: string;
  category?: string | null;
  answer_text: string;
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  metrics: Record<string, unknown>;
  dimension_scores: {
    relevance: number;
    completeness: number;
    specificity: number;
    structure: number;
  };
};

export type GeneratedQuestion = {
  category?: string | null;
  question: string;
  rationale?: string | null;
  answer_text?: string | null;
  answer_started_at?: string | null;
  answer_ended_at?: string | null;
  answer_duration_seconds?: number | null;
  transcript_segments?: TranscriptItem[] | null;
  answer_review?: QuestionResponseReview | null;
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
  evaluation?: QuestionResponseReview | null;
};

export type VisionFrame = {
  timestamp: number;
  face_present: boolean;
  looking_at_camera: boolean;
  smile_prob?: number | null;
  head_yaw?: number | null;
  head_pitch?: number | null;
  mouth_open_ratio?: number | null;
  mouth_movement_delta?: number | null;
  articulation_active?: boolean | null;
};

export type SessionRecording = {
  blob: Blob;
  mimeType: string;
  size: number;
  durationSeconds: number | null;
};

export type MediaDeviceOption = {
  deviceId: string;
  label: string;
};

export type MediaDeviceCatalog = {
  audioInputs: MediaDeviceOption[];
  videoInputs: MediaDeviceOption[];
};

export type MediaDeviceSelection = {
  audioInputId: string;
  videoInputId: string;
};

export type ActiveQuestion = {
  text: string;
  index: number;
  total: number;
};
