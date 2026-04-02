export type RecordMode = "video" | "audio" | "both";
export type FeedbackStatus = "idle" | "loading" | "ready" | "error";

export type TranscriptItem = {
  text: string;
  isFinal: boolean;
  ts: number;
};

export type VisionFrame = {
  timestamp: number;
  face_present: boolean;
  looking_at_camera: boolean;
  smile_prob?: number | null;
  head_yaw?: number | null;
  head_pitch?: number | null;
};
