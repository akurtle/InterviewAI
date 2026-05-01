import { isCallEnvironmentId } from "./callEnvironments";
import type {
  CallEnvironmentId,
  LiveArticulationStats,
  MediaDeviceCatalog,
  MediaDeviceSelection,
  VisionFrame,
} from "../../types/interview";

const MEDIA_SELECTION_STORAGE_KEY = "interview-ai:selected-media-devices";
const MOUTH_TRACKING_STORAGE_KEY = "interview-ai:mouth-tracking-enabled";
const CALL_ENVIRONMENT_STORAGE_KEY = "interview-ai:call-environment";

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

export const formatPercent = (value: number | null) => {
  if (value === null) return "N/A";
  return `${Math.round(value * 100)}%`;
};

export const normalizeVisionFrame = (data: unknown): VisionFrame | null => {
  if (!data) return null;

  const source = data as {
    frame?: unknown;
    payload?: unknown;
    data?: unknown;
  };
  const frame =
    source.frame ??
    (typeof source.payload === "object" && source.payload !== null && "frame" in source.payload
      ? (source.payload as { frame?: unknown }).frame
      : undefined) ??
    (typeof source.data === "object" && source.data !== null && "frame" in source.data
      ? (source.data as { frame?: unknown }).frame
      : undefined) ??
    source.payload ??
    source.data ??
    source;

  if (typeof frame !== "object" || frame === null) {
    return null;
  }

  const frameData = frame as Record<string, unknown>;

  const facePresent =
    parseOptionalBoolean(frameData.face_present ?? frameData.facePresent) ??
    [
      frameData.looking_at_camera,
      frameData.lookingAtCamera,
      frameData.smile_prob,
      frameData.smileProb,
      frameData.head_yaw,
      frameData.headYaw,
      frameData.head_pitch,
      frameData.headPitch,
      frameData.mouth_open_ratio,
      frameData.mouthOpenRatio,
      frameData.mouth_movement_delta,
      frameData.mouthMovementDelta,
      frameData.articulation_active,
      frameData.articulationActive,
    ].some((value) => value !== undefined && value !== null);

  if (
    !facePresent &&
    parseOptionalBoolean(frameData.face_present ?? frameData.facePresent) === null
  ) {
    return null;
  }

  const lookingAtCamera =
    parseOptionalBoolean(frameData.looking_at_camera ?? frameData.lookingAtCamera) ?? false;

  return {
    timestamp: parseTimestampSeconds(frameData.timestamp),
    face_present: facePresent,
    looking_at_camera: facePresent ? lookingAtCamera : false,
    smile_prob: parseOptionalNumber(frameData.smile_prob ?? frameData.smileProb),
    head_yaw: parseOptionalNumber(frameData.head_yaw ?? frameData.headYaw),
    head_pitch: parseOptionalNumber(frameData.head_pitch ?? frameData.headPitch),
    mouth_open_ratio: parseOptionalNumber(
      frameData.mouth_open_ratio ?? frameData.mouthOpenRatio
    ),
    mouth_movement_delta: parseOptionalNumber(
      frameData.mouth_movement_delta ?? frameData.mouthMovementDelta
    ),
    articulation_active: parseOptionalBoolean(
      frameData.articulation_active ?? frameData.articulationActive
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
