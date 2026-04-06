import type { GeneratedQuestion, RecordMode, TranscriptItem, VisionFrame } from "./components/Interview/types";
import { isSupabaseConfigured, supabase } from "./supabase";

export type SessionQuestionContext = {
  role: string;
  company: string;
  callType: string;
};

export type SessionSavePayload = {
  userId: string;
  sessionType: "interview" | "pitch";
  recordMode: RecordMode;
  questionContext: SessionQuestionContext;
  questions: GeneratedQuestion[];
  transcripts: TranscriptItem[];
  visionFrames: VisionFrame[];
  speechFeedback: unknown | null;
  videoFeedback: unknown | null;
  startedAt: string;
  endedAt: string;
};

export type StoredInterviewSession = {
  id: string;
  user_id: string;
  session_type: "interview" | "pitch";
  record_mode: RecordMode;
  question_context: SessionQuestionContext;
  questions: GeneratedQuestion[];
  transcripts: TranscriptItem[];
  vision_frames: VisionFrame[];
  speech_feedback: unknown | null;
  video_feedback: unknown | null;
  speech_score: number | null;
  video_score: number | null;
  started_at: string;
  ended_at: string;
  created_at: string;
};

export async function saveInterviewSession(payload: SessionSavePayload) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("interview_sessions")
    .insert({
      user_id: payload.userId,
      session_type: payload.sessionType,
      record_mode: payload.recordMode,
      question_context: payload.questionContext,
      questions: payload.questions,
      transcripts: payload.transcripts,
      vision_frames: payload.visionFrames,
      speech_feedback: payload.speechFeedback,
      video_feedback: payload.videoFeedback,
      speech_score:
        typeof (payload.speechFeedback as { score?: unknown } | null)?.score === "number"
          ? (payload.speechFeedback as { score: number }).score
          : null,
      video_score:
        typeof (payload.videoFeedback as { score?: unknown } | null)?.score === "number"
          ? (payload.videoFeedback as { score: number }).score
          : null,
      started_at: payload.startedAt,
      ended_at: payload.endedAt,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as StoredInterviewSession;
}

export async function listInterviewSessions(limit = 20) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("interview_sessions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as StoredInterviewSession[];
}
