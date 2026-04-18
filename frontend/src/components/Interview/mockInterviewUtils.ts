import { isCallEnvironmentId, type CallEnvironmentId } from "./callEnvironments";
import type {
  MediaDeviceCatalog,
  MediaDeviceSelection,
  RecordMode,
  StartupMetrics,
  VisionFrame,
} from "./types";

const MEDIA_SELECTION_STORAGE_KEY = "interview-ai:selected-media-devices";
const MOUTH_TRACKING_STORAGE_KEY = "interview-ai:mouth-tracking-enabled";
const CALL_ENVIRONMENT_STORAGE_KEY = "interview-ai:call-environment";

export type ActiveQuestion = {
  text: string;
  index: number;
  total: number;
};

export type LiveArticulationStats = {
  mouthOpenRatio: number | null;
  articulationRate: number | null;
  mouthMovement: number | null;
  statusText: string;
  toneClassName: string;
};

const parseTimestampSeconds = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e11 ? value / 1000 : value;
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric > 1e11 ? numeric / 1000 : numeric;
    }

    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed / 1000;
    }
  }

  return Date.now() / 1000;
};

const parseOptionalBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return null;
};

const parseOptionalNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

export const createEmptyStartupMetrics = (): StartupMetrics => ({
  session_started_at_ms: null,
  media_stream_ready_ms: null,
  offer_created_ms: null,
  ice_gathering_complete_ms: null,
  results_socket_ready_ms: null,
  signaling_response_ms: null,
  remote_description_ready_ms: null,
  ice_connected_ms: null,
  webrtc_connected_ms: null,
  asr_socket_ready_ms: null,
  asr_recording_ready_ms: null,
  session_ready_ms: null,
});

export const createEmptyMediaDeviceCatalog = (): MediaDeviceCatalog => ({
  audioInputs: [],
  videoInputs: [],
});

export const readStoredMediaSelection = (): MediaDeviceSelection => {
  if (typeof window === "undefined") {
    return { audioInputId: "", videoInputId: "" };
  }

  try {
    const raw = window.localStorage.getItem(MEDIA_SELECTION_STORAGE_KEY);
    if (!raw) {
      return { audioInputId: "", videoInputId: "" };
    }

    const parsed = JSON.parse(raw) as Partial<MediaDeviceSelection>;
    return {
      audioInputId: typeof parsed.audioInputId === "string" ? parsed.audioInputId : "",
      videoInputId: typeof parsed.videoInputId === "string" ? parsed.videoInputId : "",
    };
  } catch {
    return { audioInputId: "", videoInputId: "" };
  }
};

export const readStoredMouthTrackingEnabled = () => {
  if (typeof window === "undefined") {
    return true;
  }

  const raw = window.localStorage.getItem(MOUTH_TRACKING_STORAGE_KEY);
  if (raw === null) {
    return true;
  }

  return raw !== "false";
};

export const readStoredCallEnvironment = (): CallEnvironmentId => {
  if (typeof window === "undefined") {
    return "teams";
  }

  const raw = window.localStorage.getItem(CALL_ENVIRONMENT_STORAGE_KEY);
  return isCallEnvironmentId(raw) ? raw : "teams";
};

export const persistMediaSelection = (selection: MediaDeviceSelection) => {
  window.localStorage.setItem(MEDIA_SELECTION_STORAGE_KEY, JSON.stringify(selection));
};

export const persistMouthTrackingEnabled = (enabled: boolean) => {
  window.localStorage.setItem(MOUTH_TRACKING_STORAGE_KEY, enabled ? "true" : "false");
};

export const persistCallEnvironment = (environment: CallEnvironmentId) => {
  window.localStorage.setItem(CALL_ENVIRONMENT_STORAGE_KEY, environment);
};

export const buildDeviceLabel = (device: MediaDeviceInfo, index: number) => {
  const label = device.label.trim();
  if (label) {
    return label;
  }

  return device.kind === "audioinput" ? `Microphone ${index + 1}` : `Camera ${index + 1}`;
};

export const computeSessionReadyMs = (metrics: StartupMetrics, mode: RecordMode) => {
  if (mode === "audio") {
    return metrics.asr_recording_ready_ms;
  }

  if (mode === "video") {
    return metrics.webrtc_connected_ms;
  }

  if (
    typeof metrics.webrtc_connected_ms === "number" &&
    typeof metrics.asr_recording_ready_ms === "number"
  ) {
    return Math.max(metrics.webrtc_connected_ms, metrics.asr_recording_ready_ms);
  }

  return null;
};

export const formatPercent = (value: number | null) => {
  if (value === null) return "N/A";
  return `${Math.round(value * 100)}%`;
};

export const normalizeVisionFrame = (data: unknown): VisionFrame | null => {
  if (!data) return null;

  const source = data as any;
  const frame =
    source.frame ??
    source.payload?.frame ??
    source.data?.frame ??
    source.payload ??
    source.data ??
    source;

  const facePresent =
    parseOptionalBoolean(frame.face_present ?? frame.facePresent) ??
    [
      frame.looking_at_camera,
      frame.lookingAtCamera,
      frame.smile_prob,
      frame.smileProb,
      frame.head_yaw,
      frame.headYaw,
      frame.head_pitch,
      frame.headPitch,
      frame.mouth_open_ratio,
      frame.mouthOpenRatio,
      frame.mouth_movement_delta,
      frame.mouthMovementDelta,
      frame.articulation_active,
      frame.articulationActive,
    ].some((value) => value !== undefined && value !== null);

  if (!facePresent && parseOptionalBoolean(frame.face_present ?? frame.facePresent) === null) {
    return null;
  }

  const lookingAtCamera =
    parseOptionalBoolean(frame.looking_at_camera ?? frame.lookingAtCamera) ?? false;

  return {
    timestamp: parseTimestampSeconds(frame.timestamp),
    face_present: facePresent,
    looking_at_camera: facePresent ? lookingAtCamera : false,
    smile_prob: parseOptionalNumber(frame.smile_prob ?? frame.smileProb),
    head_yaw: parseOptionalNumber(frame.head_yaw ?? frame.headYaw),
    head_pitch: parseOptionalNumber(frame.head_pitch ?? frame.headPitch),
    mouth_open_ratio: parseOptionalNumber(frame.mouth_open_ratio ?? frame.mouthOpenRatio),
    mouth_movement_delta: parseOptionalNumber(
      frame.mouth_movement_delta ?? frame.mouthMovementDelta
    ),
    articulation_active: parseOptionalBoolean(
      frame.articulation_active ?? frame.articulationActive
    ),
  };
};

export const getLiveArticulationStats = (
  visionFrames: VisionFrame[],
  mouthTrackingEnabled: boolean
): LiveArticulationStats => {
  const recentMouthFrames = visionFrames.filter(
    (frame) =>
      mouthTrackingEnabled &&
      (typeof frame.mouth_open_ratio === "number" ||
        typeof frame.mouth_movement_delta === "number" ||
        typeof frame.articulation_active === "boolean")
  );

  const latestMouthFrame =
    recentMouthFrames.length > 0 ? recentMouthFrames[recentMouthFrames.length - 1] : null;
  const mouthFramesWindow = recentMouthFrames.slice(-8);
  const mouthOpenSamples = mouthFramesWindow.filter(
    (frame) => typeof frame.mouth_open_ratio === "number"
  );
  const mouthMovementSamples = mouthFramesWindow.filter(
    (frame) => typeof frame.mouth_movement_delta === "number"
  );

  const mouthOpenRatio =
    mouthOpenSamples.length > 0
      ? mouthFramesWindow.reduce((sum, frame) => sum + (frame.mouth_open_ratio ?? 0), 0) /
        mouthOpenSamples.length
      : null;

  const articulationRate =
    mouthFramesWindow.length > 0
      ? mouthFramesWindow.filter((frame) => frame.articulation_active === true).length /
        mouthFramesWindow.length
      : null;

  const mouthMovement =
    mouthMovementSamples.length > 0
      ? mouthFramesWindow.reduce((sum, frame) => sum + (frame.mouth_movement_delta ?? 0), 0) /
        mouthMovementSamples.length
      : null;

  return {
    mouthOpenRatio,
    articulationRate,
    mouthMovement,
    statusText:
      latestMouthFrame === null
        ? "Waiting for backend mouth tracking..."
        : latestMouthFrame.articulation_active
          ? "Good visible articulation"
          : "Mouth movement looks limited",
    toneClassName:
      latestMouthFrame?.articulation_active === true
        ? "text-emerald-300"
        : latestMouthFrame
          ? "text-yellow-300"
          : "theme-text-muted",
  };
};
