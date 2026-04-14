import type {
  GeneratedQuestion,
  QuestionAnswerReview,
  RecordMode,
  SessionRecording,
  TranscriptItem,
  VisionFrame,
} from "./components/Interview/types";
import { isSupabaseConfigured, supabase } from "./supabase";

const SESSION_RECORDINGS_BUCKET = "session-recordings";

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
  session_type: "interview" | "pitch";
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

const getRecordingExtension = (mimeType: string) => {
  const normalized = mimeType.toLowerCase();

  if (normalized.includes("mp4")) {
    return "mp4";
  }
  if (normalized.includes("ogg")) {
    return "ogg";
  }

  return "webm";
};

const uploadSessionRecording = async (
  sessionId: string,
  userId: string,
  recording: SessionRecording
) => {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const extension = getRecordingExtension(recording.mimeType);
  const path = `${userId}/${sessionId}/recording.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(SESSION_RECORDINGS_BUCKET)
    .upload(path, recording.blob, {
      contentType: recording.mimeType || "video/webm",
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { error: updateError } = await supabase
    .from("interview_sessions")
    .update({
      recording_bucket: SESSION_RECORDINGS_BUCKET,
      recording_path: path,
      recording_mime: recording.mimeType || "video/webm",
      recording_bytes: recording.size,
      recording_duration_seconds: recording.durationSeconds,
    })
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (updateError) {
    await supabase.storage.from(SESSION_RECORDINGS_BUCKET).remove([path]);
    throw updateError;
  }
};

export async function saveInterviewSession(payload: SessionSavePayload): Promise<SessionSaveResult> {
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

  if (payload.answers.length > 0) {
    const { error: answersError } = await supabase.from("interview_session_answers").insert(
      payload.answers.map((answer) => {
        const question = payload.questions[answer.index];

        return {
          session_id: data.id,
          user_id: payload.userId,
          position: answer.index,
          question_text: question?.question ?? `Question ${answer.index + 1}`,
          question_category: question?.category ?? null,
          question_rationale: question?.rationale ?? null,
          answer_text: answer.answerText,
          answer_started_at: answer.startedAtMs ? new Date(answer.startedAtMs).toISOString() : null,
          answer_ended_at: answer.endedAtMs ? new Date(answer.endedAtMs).toISOString() : null,
          transcript_segments: answer.transcriptSegments,
        };
      })
    );

    if (answersError) {
      await supabase
        .from("interview_sessions")
        .delete()
        .eq("id", data.id)
        .eq("user_id", payload.userId);
      throw answersError;
    }
  }

  let warning: string | null = null;
  let recordingSaved = false;

  if (payload.recording) {
    try {
      await uploadSessionRecording(data.id, payload.userId, payload.recording);
      recordingSaved = true;
    } catch (recordingError) {
      console.error("Recording upload failed:", recordingError);
      warning = "Session saved, but the recording could not be uploaded.";
    }
  }

  const finalSession =
    recordingSaved && payload.recording
      ? ({
          ...data,
          recording_bucket: SESSION_RECORDINGS_BUCKET,
          recording_path: `${payload.userId}/${data.id}/recording.${getRecordingExtension(payload.recording.mimeType)}`,
          recording_mime: payload.recording.mimeType || "video/webm",
          recording_bytes: payload.recording.size,
          recording_duration_seconds: payload.recording.durationSeconds,
        } as StoredInterviewSession)
      : (data as StoredInterviewSession);

  return {
    session: finalSession,
    recordingSaved,
    warning,
  };
}

export async function listInterviewSessions(userId: string, limit = 20) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("interview_session_summaries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as StoredInterviewSessionSummary[];
}

export async function getInterviewSession(sessionId: string, userId: string) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("id", sessionId)
    .single();

  if (error) {
    throw error;
  }

  return data as StoredInterviewSession;
}

export async function getInterviewSessionRecordingUrl(
  session: Pick<StoredInterviewSession, "recording_bucket" | "recording_path">,
  expiresIn = 3600
) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  if (!session.recording_bucket || !session.recording_path) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(session.recording_bucket)
    .createSignedUrl(session.recording_path, expiresIn);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}

export async function listInterviewSessionAnswers(sessionId: string, userId: string) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("interview_session_answers")
    .select("*")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .order("position", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as StoredInterviewSessionAnswer[];
}
