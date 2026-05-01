import type {
  GeneratedQuestion,
  QuestionAnswerReview,
  RecordMode,
  SessionRecording,
  SessionType,
  TranscriptItem,
  VisionFrame,
} from "./interview";

export type SessionQuestionContext = {
  role: string;
  company: string;
  callType: string;
};

export type SessionSavePayload = {
  userId: string;
  sessionType: SessionType;
  recordMode: RecordMode;
  questionContext: SessionQuestionContext;
  questions: GeneratedQuestion[];
  answers: QuestionAnswerReview[];
  transcripts: TranscriptItem[];
  visionFrames: VisionFrame[];
  speechFeedback: unknown | null;
  videoFeedback: unknown | null;
  recording: SessionRecording | null;
  startedAt: string;
  endedAt: string;
};

export type SessionSaveResult = {
  session: StoredInterviewSession;
  recordingSaved: boolean;
  warning: string | null;
};

export type StoredInterviewSession = {
  id: string;
  user_id: string;
  session_type: SessionType;
  record_mode: RecordMode;
  question_context: SessionQuestionContext;
  questions: GeneratedQuestion[];
  transcripts: TranscriptItem[];
  vision_frames: VisionFrame[];
  speech_feedback: unknown | null;
  video_feedback: unknown | null;
  speech_score: number | null;
  video_score: number | null;
  recording_bucket: string | null;
  recording_path: string | null;
  recording_mime: string | null;
  recording_bytes: number | null;
  recording_duration_seconds: number | null;
  started_at: string;
  ended_at: string;
  created_at: string;
};

export type StoredInterviewSessionSummary = {
  id: string;
  user_id: string;
  session_type: SessionType;
  record_mode: RecordMode;
  role: string | null;
  company: string | null;
  call_type: string | null;
  question_count: number;
  transcript_count: number;
  vision_frame_count: number;
  duration_seconds: number;
  speech_score: number | null;
  video_score: number | null;
  has_recording: boolean;
  started_at: string;
  ended_at: string;
  created_at: string;
  updated_at: string;
};

export type StoredInterviewSessionAnswer = {
  id: string;
  session_id: string;
  user_id: string;
  position: number;
  question_text: string;
  question_category: string | null;
  question_rationale: string | null;
  answer_text: string | null;
  answer_started_at: string | null;
  answer_ended_at: string | null;
  answer_duration_seconds: number | null;
  transcript_segments: TranscriptItem[];
  created_at: string;
};
