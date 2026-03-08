export type RecordMode = "video" | "audio" | "both";
export type FeedbackStatus = "idle" | "loading" | "ready" | "error";

export type TranscriptItem = {
  text: string;
  isFinal: boolean;
  ts: number;
};

export type VisionFrame = {
  timestamp: number;
  image_base64: string;
};
