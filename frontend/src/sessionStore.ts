import type { SessionRecording } from "./types/interview";
import type {
  SessionSavePayload,
  SessionSaveResult,
  StoredInterviewSession,
  StoredInterviewSessionAnswer,
  StoredInterviewSessionSummary,
} from "./types/session";
import { isSupabaseConfigured, supabase } from "./supabase";

const SESSION_RECORDINGS_BUCKET = "session-recordings";

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
