import { useEffect, useRef, useState } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import WebRTCRecorder from "../components/Interview/WebRTCRecorder";
import { useWhisperWS } from "../components/Interview/useWhisper";
import QuestionGenerator from "../components/Interview/QuestionGenerator";
import FeedbackPanel from "../components/Interview/FeedbackPanel";
import SettingsModal from "../components/Interview/SettingsModal";
import {
  CALL_ENVIRONMENT_OPTIONS,
  CALL_ENVIRONMENT_PRESETS,
  isCallEnvironmentId,
  type CallEnvironmentId,
} from "../components/Interview/callEnvironments";
import type {
  GeneratedQuestion,
  MediaDeviceCatalog,
  MediaDeviceSelection,
  QuestionAnswerReview,
  RecordMode,
  SessionRecording,
  StartupMetricKey,
  StartupMetrics,
  TranscriptItem,
  VisionFrame,
} from "../components/Interview/types";
import { useAuth } from "../auth";
import { useSessionType } from "../hooks/useSessionType";
import { useFeedbackRequests } from "../hooks/useFeedbackRequests";
import { getApiBase, getWsBase } from "../network";
import { saveInterviewSession, type SessionQuestionContext } from "../sessionStore";

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

const createEmptyStartupMetrics = (): StartupMetrics => ({
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

const createEmptyMediaDeviceCatalog = (): MediaDeviceCatalog => ({
  audioInputs: [],
  videoInputs: [],
});

const readStoredMediaSelection = (): MediaDeviceSelection => {
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

const readStoredMouthTrackingEnabled = () => {
  if (typeof window === "undefined") {
    return true;
  }

  const raw = window.localStorage.getItem(MOUTH_TRACKING_STORAGE_KEY);
  if (raw === null) {
    return true;
  }

  return raw !== "false";
};

const readStoredCallEnvironment = (): CallEnvironmentId => {
  if (typeof window === "undefined") {
    return "teams";
  }

  const raw = window.localStorage.getItem(CALL_ENVIRONMENT_STORAGE_KEY);
  return isCallEnvironmentId(raw) ? raw : "teams";
};

const buildDeviceLabel = (device: MediaDeviceInfo, index: number) => {
  const label = device.label.trim();
  if (label) {
    return label;
  }

  return device.kind === "audioinput" ? `Microphone ${index + 1}` : `Camera ${index + 1}`;
};

const computeSessionReadyMs = (metrics: StartupMetrics, mode: RecordMode) => {
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

const formatPercent = (value: number | null) => {
  if (value === null) return "N/A";
  return `${Math.round(value * 100)}%`;
};

const MockInterview = () => {
  const [recordMode, setRecordMode] = useState<RecordMode>("both");
  const [connectionStatus, setConnectionStatus] = useState<string>("idle");
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [interviewStartSignal, setInterviewStartSignal] = useState(0);
  const [visionData, setVisionData] = useState<any>(null);
  const [visionFrames, setVisionFrames] = useState<VisionFrame[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<QuestionAnswerReview[]>([]);
  const [questionContext, setQuestionContext] = useState<SessionQuestionContext>({
    role: "",
    company: "",
    callType: "",
  });
  const [sessionSaveStatus, setSessionSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [sessionSaveMessage, setSessionSaveMessage] = useState<string | null>(null);
  const [, setSessionRecording] = useState<SessionRecording | null>(null);
  const [sharedMediaStream, setSharedMediaStream] = useState<MediaStream | null>(null);
  const [startupMetrics, setStartupMetrics] = useState<StartupMetrics>(createEmptyStartupMetrics);
  const [mediaDevices, setMediaDevices] = useState<MediaDeviceCatalog>(createEmptyMediaDeviceCatalog);
  const [mediaSelection, setMediaSelection] = useState<MediaDeviceSelection>(readStoredMediaSelection);
  const [mouthTrackingEnabled, setMouthTrackingEnabled] = useState<boolean>(
    readStoredMouthTrackingEnabled
  );
  const [isRefreshingMediaDevices, setIsRefreshingMediaDevices] = useState(false);
  const [mediaDeviceMessage, setMediaDeviceMessage] = useState<string | null>(null);
  const [mediaDeviceLabelsAvailable, setMediaDeviceLabelsAvailable] = useState(false);
  const [callEnvironment, setCallEnvironment] = useState<CallEnvironmentId>(
    readStoredCallEnvironment
  );
  const [isAudioPanelFullscreen, setIsAudioPanelFullscreen] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<{
    text: string;
    index: number;
    total: number;
  } | null>(null);

  const prevConnectionStatusRef = useRef(connectionStatus);
  const prevAudioRunningRef = useRef(false);
  const audioPanelRef = useRef<HTMLDivElement | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const persistedSessionKeyRef = useRef<string>("");
  const sessionRecordingRef = useRef<SessionRecording | null>(null);
  const mediaSelectionRef = useRef(mediaSelection);
  const API_BASE = getApiBase();
  const WS_BASE = getWsBase();
  const { endpoints, sessionType } = useSessionType();
  const { user, isConfigured: isSupabaseConfigured } = useAuth();
  const selectedEnvironment = CALL_ENVIRONMENT_PRESETS[callEnvironment];
  const supportsFullscreen =
    typeof document !== "undefined" &&
    typeof document.fullscreenEnabled === "boolean" &&
    document.fullscreenEnabled;

  const refreshMediaDevices = async (requestAccess = false) => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setMediaDeviceMessage("This browser cannot list microphones or cameras yet.");
      return;
    }

    setIsRefreshingMediaDevices(true);

    try {
      if (requestAccess && navigator.mediaDevices.getUserMedia) {
        const attempts: MediaStreamConstraints[] = [
          { audio: true, video: true },
          { audio: true, video: false },
          { audio: false, video: true },
        ];

        let permissionError: unknown = null;

        for (const constraints of attempts) {
          try {
            const permissionStream = await navigator.mediaDevices.getUserMedia(constraints);
            permissionStream.getTracks().forEach((track) => track.stop());
            permissionError = null;
            break;
          } catch (error) {
            permissionError = error;
          }
        }

        if (permissionError) {
          throw permissionError;
        }
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter((device) => device.kind === "audioinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: buildDeviceLabel(device, index),
        }));
      const videoInputs = devices
        .filter((device) => device.kind === "videoinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: buildDeviceLabel(device, index),
        }));
      const labelsAvailable = devices.some(
        (device) =>
          (device.kind === "audioinput" || device.kind === "videoinput") &&
          device.label.trim().length > 0
      );

      setMediaDevices({ audioInputs, videoInputs });
      setMediaDeviceLabelsAvailable(labelsAvailable);

      const currentSelection = mediaSelectionRef.current;
      const nextSelection: MediaDeviceSelection = {
        audioInputId: audioInputs.some((device) => device.deviceId === currentSelection.audioInputId)
          ? currentSelection.audioInputId
          : "",
        videoInputId: videoInputs.some((device) => device.deviceId === currentSelection.videoInputId)
          ? currentSelection.videoInputId
          : "",
      };

      const lostAudioSelection =
        Boolean(currentSelection.audioInputId) && nextSelection.audioInputId !== currentSelection.audioInputId;
      const lostVideoSelection =
        Boolean(currentSelection.videoInputId) && nextSelection.videoInputId !== currentSelection.videoInputId;

      if (lostAudioSelection || lostVideoSelection) {
        setMediaSelection(nextSelection);
        setMediaDeviceMessage(
          "A selected external device is no longer available. The app will use your default device until you choose another one."
        );
      } else if (requestAccess && labelsAvailable) {
        setMediaDeviceMessage("Device list updated. Your external microphones and cameras are ready to use.");
      } else if (!labelsAvailable) {
        setMediaDeviceMessage(
          "Allow camera or microphone access once to reveal device names for external devices."
        );
      } else {
        setMediaDeviceMessage(null);
      }
    } catch (error) {
      console.error("Failed to refresh media devices:", error);
      setMediaDeviceMessage(
        error instanceof Error
          ? error.message
          : "The browser could not refresh the available microphones and cameras."
      );
    } finally {
      setIsRefreshingMediaDevices(false);
    }
  };

  const handleTranscript = (text: string, isFinal: boolean) => {
    // console.log("Transcript:", text, "Final:", isFinal);
    setTranscripts((prev) => [...prev, { text, isFinal, ts: Date.now() }]);
  };

  const {
    start: startAudio,
    stop: stopAudio,
    isRunning: isAudioRunning,
    status: audioStatus,
  } = useWhisperWS(`${WS_BASE}/asr`, {
    onTranscript: handleTranscript,
    onStartupMetric: (metric) => {
      markStartupMetric(metric);
    },
  });

  const {
    speechFeedback,
    videoFeedback,
    speechFeedbackStatus,
    videoFeedbackStatus,
    feedbackError,
    markSessionStart,
    requestFeedback,
  } = useFeedbackRequests({
    apiBase: API_BASE,
    speechEndpoint: endpoints.speech,
    videoEndpoint: endpoints.video,
    transcripts,
    visionFrames,
  });

  const triggerInterviewStart = () => {
    setInterviewStartSignal((prev) => prev + 1);
  };

  const beginSession = () => {
    sessionStartedAtRef.current = Date.now();
    persistedSessionKeyRef.current = "";
    sessionRecordingRef.current = null;
    setSharedMediaStream(null);
    setSessionRecording(null);
    setStartupMetrics({
      ...createEmptyStartupMetrics(),
      session_started_at_ms: 0,
    });
    setSessionSaveStatus("idle");
    setSessionSaveMessage(null);
    markSessionStart();
    triggerInterviewStart();
  };

  function markStartupMetric(metric: StartupMetricKey) {
    const startedAt = sessionStartedAtRef.current;
    if (startedAt == null) return;

    setStartupMetrics((prev) => {
      if (prev[metric] !== null) {
        return prev;
      }

      const next = {
        ...prev,
        [metric]: metric === "session_started_at_ms" ? 0 : Date.now() - startedAt,
      } as StartupMetrics;

      return {
        ...next,
        session_ready_ms: computeSessionReadyMs(next, recordMode),
      };
    });
  }

  const normalizeVisionFrame = (data: any): VisionFrame | null => {
    if (!data) return null;
    const frame =
      data.frame ??
      data.payload?.frame ??
      data.data?.frame ??
      data.payload ??
      data.data ??
      data;

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
    const smileProb = parseOptionalNumber(frame.smile_prob ?? frame.smileProb);
    const headYaw = parseOptionalNumber(frame.head_yaw ?? frame.headYaw);
    const headPitch = parseOptionalNumber(frame.head_pitch ?? frame.headPitch);
    const mouthOpenRatio = parseOptionalNumber(
      frame.mouth_open_ratio ?? frame.mouthOpenRatio
    );
    const mouthMovementDelta = parseOptionalNumber(
      frame.mouth_movement_delta ?? frame.mouthMovementDelta
    );
    const articulationActive =
      parseOptionalBoolean(frame.articulation_active ?? frame.articulationActive);

    return {
      timestamp: parseTimestampSeconds(frame.timestamp),
      face_present: facePresent,
      looking_at_camera: facePresent ? lookingAtCamera : false,
      smile_prob: smileProb,
      head_yaw: headYaw,
      head_pitch: headPitch,
      mouth_open_ratio: mouthOpenRatio,
      mouth_movement_delta: mouthMovementDelta,
      articulation_active: articulationActive,
    };
  };

  const recentMouthFrames = visionFrames.filter(
    (frame) =>
      mouthTrackingEnabled &&
      (
        typeof frame.mouth_open_ratio === "number" ||
        typeof frame.mouth_movement_delta === "number" ||
        typeof frame.articulation_active === "boolean"
      )
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
  const liveMouthOpenRatio =
    mouthOpenSamples.length > 0
      ? mouthFramesWindow.reduce(
          (sum, frame) => sum + (frame.mouth_open_ratio ?? 0),
          0
        ) / mouthOpenSamples.length
      : null;
  const liveArticulationRate =
    mouthFramesWindow.length > 0
      ? mouthFramesWindow.filter((frame) => frame.articulation_active === true).length /
        mouthFramesWindow.length
      : null;
  const liveMouthMovement =
    mouthMovementSamples.length > 0
      ? mouthFramesWindow.reduce(
          (sum, frame) => sum + (frame.mouth_movement_delta ?? 0),
          0
        ) / mouthMovementSamples.length
      : null;
  const liveArticulationStatus =
    latestMouthFrame === null
      ? "Waiting for backend mouth tracking..."
      : latestMouthFrame.articulation_active
        ? "Good visible articulation"
        : "Mouth movement looks limited";
  const liveArticulationTone =
    latestMouthFrame?.articulation_active === true
      ? "text-emerald-300"
      : latestMouthFrame
        ? "text-yellow-300"
        : "theme-text-muted";

  const audioStatusLabel =
    audioStatus === "recording"
      ? "Recording..."
      : audioStatus === "connecting"
        ? "Connecting..."
        : audioStatus === "connected"
          ? "Preparing..."
          : audioStatus === "error"
            ? "Error"
            : "Ready to start";

  const audioStatusDot =
    audioStatus === "recording"
      ? "bg-emerald-500 animate-pulse"
      : audioStatus === "connecting" || audioStatus === "connected"
        ? "bg-yellow-500 animate-pulse"
        : audioStatus === "error"
          ? "bg-red-500"
          : "bg-gray-600";

  const isSessionLocked = connectionStatus === "connected" || connectionStatus === "connecting";

  useEffect(() => {
    mediaSelectionRef.current = mediaSelection;
    window.localStorage.setItem(MEDIA_SELECTION_STORAGE_KEY, JSON.stringify(mediaSelection));
  }, [mediaSelection]);

  useEffect(() => {
    window.localStorage.setItem(
      MOUTH_TRACKING_STORAGE_KEY,
      mouthTrackingEnabled ? "true" : "false"
    );
  }, [mouthTrackingEnabled]);

  useEffect(() => {
    window.localStorage.setItem(CALL_ENVIRONMENT_STORAGE_KEY, callEnvironment);
  }, [callEnvironment]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsAudioPanelFullscreen(document.fullscreenElement === audioPanelRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setMediaDeviceMessage("This browser cannot list microphones or cameras yet.");
      return;
    }

    void refreshMediaDevices();

    const mediaDevicesApi = navigator.mediaDevices;
    const handleDeviceChange = () => {
      void refreshMediaDevices();
    };

    mediaDevicesApi.addEventListener?.("devicechange", handleDeviceChange);

    return () => {
      mediaDevicesApi.removeEventListener?.("devicechange", handleDeviceChange);
    };
  }, []);

  const handleVisionData = (data: any) => {
    console.log("Vision data:", data);
    if (data?.type !== "frame") {
      setVisionData(data);
    }
    const frame = normalizeVisionFrame(data);
    if (frame) {
      setVisionFrames((prev) => (prev.length > 500 ? [...prev.slice(-500), frame] : [...prev, frame]));
    }
  };

  const handlePreferredDevicesUnavailable = (kinds: Array<"audioinput" | "videoinput">) => {
    setMediaSelection((current) => ({
      audioInputId: kinds.includes("audioinput") ? "" : current.audioInputId,
      videoInputId: kinds.includes("videoinput") ? "" : current.videoInputId,
    }));

    if (kinds.length === 2) {
      setMediaDeviceMessage(
        "Your selected external microphone and camera were unavailable, so the app switched back to the system defaults."
      );
      return;
    }

    const label = kinds[0] === "audioinput" ? "microphone" : "camera";
    setMediaDeviceMessage(
      `Your selected external ${label} was unavailable, so the app switched back to the system default.`
    );
  };

  const handleAudioToggle = async () => {
    if (isAudioRunning) {
      stopAudio();
      return;
    }
    beginSession();
    await startAudio(undefined, {
      audioDeviceId: mediaSelection.audioInputId,
      onPreferredDeviceUnavailable: () => {
        handlePreferredDevicesUnavailable(["audioinput"]);
      },
    });
  };

  const toggleAudioPanelFullscreen = async () => {
    if (!supportsFullscreen || !audioPanelRef.current) {
      return;
    }

    try {
      if (document.fullscreenElement === audioPanelRef.current) {
        await document.exitFullscreen();
        return;
      }

      await audioPanelRef.current.requestFullscreen();
    } catch (fullscreenError) {
      console.error("Failed to toggle audio panel fullscreen mode:", fullscreenError);
    }
  };

  const persistSession = async () => {
    const feedbackResult = await requestFeedback();
    const effectiveFeedbackResult = feedbackResult ?? {
      sessionTranscripts: [] as TranscriptItem[],
      sessionText: "",
      sessionFrames: [] as VisionFrame[],
      speechFeedback: null,
      videoFeedback: null,
      speechStatus: "idle" as const,
      videoStatus: "idle" as const,
    };

    const hasRecording = sessionRecordingRef.current !== null;
    const hasQuestionData = generatedQuestions.length > 0 || questionAnswers.length > 0;

    if (!feedbackResult && !hasRecording && !hasQuestionData) {
      return;
    }

    if (!user || !isSupabaseConfigured) return;

    const fingerprint = JSON.stringify({
      startedAt: sessionStartedAtRef.current,
      transcriptCount: effectiveFeedbackResult.sessionTranscripts.length,
      frameCount: effectiveFeedbackResult.sessionFrames.length,
      sessionText: effectiveFeedbackResult.sessionText,
      recordingBytes: sessionRecordingRef.current?.size ?? 0,
    });

    if (persistedSessionKeyRef.current === fingerprint) {
      return;
    }

    setSessionSaveStatus("saving");
    setSessionSaveMessage("Saving session to your account...");

    try {
      const answersByIndex = new Map(questionAnswers.map((answer) => [answer.index, answer]));

      const result = await saveInterviewSession({
        userId: user.id,
        sessionType,
        recordMode,
        questionContext,
        questions: generatedQuestions.map((question, index) => ({
          ...question,
          answer_text: answersByIndex.get(index)?.answerText ?? null,
          answer_started_at: answersByIndex.get(index)?.startedAtMs
            ? new Date(answersByIndex.get(index)!.startedAtMs!).toISOString()
            : null,
          answer_ended_at: answersByIndex.get(index)?.endedAtMs
            ? new Date(answersByIndex.get(index)!.endedAtMs!).toISOString()
            : null,
          answer_duration_seconds: answersByIndex.get(index)?.durationSeconds ?? null,
          transcript_segments: answersByIndex.get(index)?.transcriptSegments ?? [],
        })),
        answers: questionAnswers,
        transcripts: effectiveFeedbackResult.sessionTranscripts,
        visionFrames: effectiveFeedbackResult.sessionFrames,
        speechFeedback: effectiveFeedbackResult.speechFeedback,
        videoFeedback: effectiveFeedbackResult.videoFeedback,
        recording: sessionRecordingRef.current,
        startedAt: new Date(sessionStartedAtRef.current ?? Date.now()).toISOString(),
        endedAt: new Date().toISOString(),
      });

      persistedSessionKeyRef.current = fingerprint;
      setSessionSaveStatus("saved");
      setSessionSaveMessage(result.warning ?? "Session saved to your account.");
    } catch (error) {
      console.error("Session persistence failed:", error);
      setSessionSaveStatus("error");
      setSessionSaveMessage(
        error instanceof Error ? error.message : "Failed to save session."
      );
    }
  };

  useEffect(() => {
    if (recordMode !== "audio") return;
    const mapped =
      audioStatus === "recording"
        ? "connected"
        : audioStatus === "connecting" || audioStatus === "connected"
          ? "connecting"
          : audioStatus === "error"
            ? "error"
            : "idle";
    setConnectionStatus(mapped);
  }, [audioStatus, recordMode]);

  useEffect(() => {
    if (recordMode === "audio") return;
    const shouldRun = connectionStatus === "connecting" || connectionStatus === "connected";
    const canStartWithSharedStream = Boolean(sharedMediaStream);

    if (
      shouldRun &&
      canStartWithSharedStream &&
      !isAudioRunning &&
      (audioStatus === "idle" || audioStatus === "error")
    ) {
      void startAudio(sharedMediaStream ?? undefined);
    }

    if (!shouldRun && (isAudioRunning || audioStatus === "connecting")) {
      stopAudio();
    }
  }, [connectionStatus, recordMode, sharedMediaStream, isAudioRunning, audioStatus, startAudio, stopAudio]);

  useEffect(() => {
    if (recordMode !== "audio") {
      prevAudioRunningRef.current = isAudioRunning;
      return;
    }

    if (prevAudioRunningRef.current && !isAudioRunning) {
      void persistSession();
    }

    prevAudioRunningRef.current = isAudioRunning;
  }, [isAudioRunning, recordMode]);

  useEffect(() => {
    if (recordMode === "audio") {
      prevConnectionStatusRef.current = connectionStatus;
      return;
    }

    const prevStatus = prevConnectionStatusRef.current;
    if (prevStatus !== connectionStatus) {
      if (prevStatus === "idle" && connectionStatus === "connecting") {
        beginSession();
      }

      if (
        (prevStatus === "connected" || prevStatus === "connecting") &&
        (connectionStatus === "idle" || connectionStatus === "disconnected" || connectionStatus === "error")
      ) {
        void persistSession();
      }
    }

    prevConnectionStatusRef.current = connectionStatus;
  }, [connectionStatus, recordMode]);

  return (
    <div className="theme-page-shell">
      <Navbar />

      <section className="relative pt-28 pb-16 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 opacity-20">
          <div className="theme-glow-primary absolute top-1/4 left-1/4 h-96 w-96 rounded-full blur-3xl animate-pulse" />
          <div className="theme-glow-secondary absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full blur-3xl animate-pulse delay-700" />
        </div>
        <div className="theme-grid-overlay absolute inset-0" />

        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-start mb-6">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="theme-ghost-link flex items-center space-x-2 text-sm transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back</span>
            </button>
          </div>
          <div className="mb-6" />
          {activeQuestion && (
            <div className="fixed top-24 left-6 z-40 max-w-md">
              <div className="theme-panel-strong rounded-2xl border px-4 py-3 shadow-lg backdrop-blur">
                <p className="theme-accent-text mb-1 text-xs">
                  Question {activeQuestion.index + 1} of {activeQuestion.total}
                </p>
                <p className="theme-text-primary text-sm">{activeQuestion.text}</p>
              </div>
            </div>
          )}
          <div className="flex justify-end mb-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsInfoOpen(true)}
                className="theme-button-secondary rounded-lg px-4 py-2 text-sm"
              >
                Info
              </button>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="theme-button-secondary rounded-lg px-4 py-2 text-sm"
              >
                Open settings
              </button>
            </div>
          </div>

          <div className="mb-6">
            <div className="theme-panel rounded-2xl p-5 backdrop-blur">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="theme-chip rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
                      {sessionType === "pitch" ? "Pitch mode" : "Interview mode"}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${selectedEnvironment.accentClassName}`}
                    >
                      UI only simulator
                    </span>
                  </div>
                  <h1 className="theme-text-primary text-2xl font-semibold">Room simulator</h1>
                </div>

                <div className="flex items-center gap-2">
                  <span className="theme-text-dim text-xs uppercase tracking-[0.2em]">
                    Current
                  </span>
                  <span
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${selectedEnvironment.accentClassName}`}
                  >
                    {selectedEnvironment.label}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {CALL_ENVIRONMENT_OPTIONS.map((environment) => {
                  const isActive = environment.id === callEnvironment;
                  return (
                    <button
                      key={environment.id}
                      type="button"
                      onClick={() => setCallEnvironment(environment.id)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        isActive ? "theme-choice-active" : "theme-choice theme-card-hover"
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${environment.accentClassName}`}
                        >
                          {environment.shortLabel}
                        </span>
                        {isActive && (
                          <span className="theme-text-primary text-xs font-semibold">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="theme-text-primary text-sm font-semibold">
                        {environment.label}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mb-6">
            {user ? (
              <div className="theme-panel-soft rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="theme-text-primary text-sm font-semibold">
                    Signed in as {user.email}
                  </p>
                  <span className="theme-chip rounded-full border px-3 py-1 text-xs font-semibold">
                    Auto-save on
                  </span>
                </div>
                {sessionSaveMessage && (
                  <p
                    className={`mt-2 text-sm ${
                      sessionSaveStatus === "error"
                        ? "text-red-300"
                        : sessionSaveStatus === "saved"
                          ? "text-emerald-300"
                          : "theme-text-muted"
                    }`}
                  >
                    {sessionSaveMessage}
                  </p>
                )}
              </div>
            ) : (
              <div className="theme-panel-soft rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="theme-text-primary text-sm font-semibold">Session saving is off</p>
                  <span className="theme-text-muted text-xs">Sign in to save history</span>
                </div>
              </div>
            )}
          </div>

          <div className={`grid gap-8 ${recordMode === "audio" ? "lg:grid-cols-1 max-w-4xl mx-auto" : "lg:grid-cols-3"}`}>
            {/* WebRTC Recorder - Takes 2 columns in video mode, full width in audio mode */}
            <div className={recordMode === "audio" ? "" : "lg:col-span-2"}>
              {recordMode === "audio" ? (
                <div
                  ref={audioPanelRef}
                  className={`theme-panel overflow-hidden backdrop-blur ${
                    isAudioPanelFullscreen ? "h-screen rounded-none" : "rounded-2xl"
                  }`}
                >
                  <div className="theme-border flex items-center justify-between border-b px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${audioStatusDot}`} />
                      <div>
                        <p className="theme-text-primary text-sm font-semibold">{audioStatusLabel}</p>
                        <p className="theme-text-muted text-xs">Audio transcription session</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {supportsFullscreen && (
                        <button
                          type="button"
                          onClick={() => {
                            void toggleAudioPanelFullscreen();
                          }}
                          className="theme-button-secondary rounded-lg px-3 py-1.5 text-xs font-semibold"
                        >
                          {isAudioPanelFullscreen ? "Exit full screen" : "Full screen"}
                        </button>
                      )}
                      <span className="theme-chip rounded border px-2 py-1 text-xs">
                        Audio only
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center p-12">
                    <div className="text-center">
                      <div className="theme-icon-badge mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full">
                        <svg
                          className="theme-accent-text h-10 w-10"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                          />
                        </svg>
                      </div>
                      <p className="theme-text-primary text-lg font-semibold">Live Audio Transcription</p>
                      <p className="theme-text-muted mt-2 text-sm">
                        {audioStatus === "recording" ? "Listening for your response..." : "Ready when you are"}
                      </p>
                    </div>
                  </div>

                  <div className="theme-border border-t px-6 py-4">
                    {audioStatus === "error" && (
                      <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-red-300 text-sm">
                          Audio connection failed. Check microphone access and backend availability.
                        </p>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={handleAudioToggle}
                        className={`flex-1 px-6 py-3 rounded-lg font-semibold transition ${
                          isAudioRunning
                            ? "theme-button-secondary"
                            : "theme-button-primary"
                        }`}
                      >
                        {isAudioRunning ? "Stop Session" : "Start Session"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <WebRTCRecorder
                  mode={recordMode}
                  sessionType={sessionType}
                  callEnvironment={callEnvironment}
                  mouthTrackingEnabled={mouthTrackingEnabled}
                  selectedAudioInputId={mediaSelection.audioInputId}
                  selectedVideoInputId={mediaSelection.videoInputId}
                  onPreferredDevicesUnavailable={handlePreferredDevicesUnavailable}
                  onStatusChange={(status) => {
                    console.log("Connection status:", status);
                    setConnectionStatus(status);
                  }}
                  onTranscript={handleTranscript}
                  onVisionData={handleVisionData}
                  onRecordingReady={(recording) => {
                    sessionRecordingRef.current = recording;
                    setSessionRecording(recording);
                  }}
                  onStreamReady={setSharedMediaStream}
                  onStartupMetric={markStartupMetric}
                />
              )}

              {/* AI Feedback */}
              {recordMode !== "audio" && mouthTrackingEnabled && (
                <div className="mt-6">
                  <div className="theme-panel rounded-2xl p-6 backdrop-blur">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="theme-text-primary text-lg font-semibold">Live articulation</h2>
                      </div>
                      <span className={`text-sm font-semibold ${liveArticulationTone}`}>
                        {liveArticulationStatus}
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="theme-panel-soft rounded-lg px-4 py-3">
                        <p className="theme-text-dim text-xs uppercase tracking-wide">
                          Mouth openness
                        </p>
                        <p className="theme-text-primary mt-1 text-xl font-semibold">
                          {formatPercent(liveMouthOpenRatio)}
                        </p>
                      </div>
                      <div className="theme-panel-soft rounded-lg px-4 py-3">
                        <p className="theme-text-dim text-xs uppercase tracking-wide">
                          Active articulation
                        </p>
                        <p className="theme-text-primary mt-1 text-xl font-semibold">
                          {formatPercent(liveArticulationRate)}
                        </p>
                      </div>
                      <div className="theme-panel-soft rounded-lg px-4 py-3">
                        <p className="theme-text-dim text-xs uppercase tracking-wide">
                          Movement change
                        </p>
                        <p className="theme-text-primary mt-1 text-xl font-semibold">
                          {liveMouthMovement === null ? "N/A" : liveMouthMovement.toFixed(3)}
                        </p>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              <div className="mt-6">
                <FeedbackPanel
                  speechFeedback={speechFeedback}
                  videoFeedback={videoFeedback}
                  speechStatus={speechFeedbackStatus}
                  videoStatus={videoFeedbackStatus}
                  error={feedbackError}
                />
              </div>
            </div>
            <div className="h-fit">
              <QuestionGenerator
                apiBase={API_BASE}
                endpointPath={endpoints.questions}
                sessionType={sessionType}
                onQuestions={(questions) => {
                  setGeneratedQuestions(questions);
                  setQuestionAnswers([]);
                }}
                onAnswersChange={setQuestionAnswers}
                onInputChange={(inputs) => setQuestionContext(inputs)}
                transcripts={transcripts}
                startSignal={interviewStartSignal}
                onCurrentQuestionChange={(question, index, total) => {
                  if (!question) {
                    setActiveQuestion(null);
                    return;
                  }
                  setActiveQuestion({
                    text: question.question,
                    index,
                    total,
                  });
                }}
              />
            </div>

          </div>
        </div>
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          recordMode={recordMode}
          callEnvironment={callEnvironment}
          onSetCallEnvironment={setCallEnvironment}
          setRecordMode={setRecordMode}
          mouthTrackingEnabled={mouthTrackingEnabled}
          onSetMouthTrackingEnabled={setMouthTrackingEnabled}
          mediaDevices={mediaDevices}
          mediaSelection={mediaSelection}
          onSelectAudioInput={(audioInputId) =>
            setMediaSelection((current) => ({ ...current, audioInputId }))
          }
          onSelectVideoInput={(videoInputId) =>
            setMediaSelection((current) => ({ ...current, videoInputId }))
          }
          onRefreshMediaDevices={() => {
            void refreshMediaDevices(!mediaDeviceLabelsAvailable);
          }}
          isRefreshingMediaDevices={isRefreshingMediaDevices}
          mediaDeviceMessage={mediaDeviceMessage}
          mediaDeviceLabelsAvailable={mediaDeviceLabelsAvailable}
          isSessionLocked={isSessionLocked}
          connectionStatus={connectionStatus}
          visionData={visionData}
          startupMetrics={startupMetrics}
        />
        {isInfoOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
              className="absolute inset-0 bg-black/70"
              onClick={() => setIsInfoOpen(false)}
            />
            <div className="theme-panel relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6 backdrop-blur">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="theme-text-primary text-lg font-semibold">Session information</h2>
                  <p className="theme-text-muted text-sm">
                    Details moved here so the practice screen stays calmer.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsInfoOpen(false)}
                  className="theme-button-secondary rounded-lg px-3 py-1.5 text-xs"
                >
                  Close
                </button>
              </div>

              <div className="space-y-4">
                <div className="theme-panel-soft rounded-2xl p-4">
                  <p className="theme-text-primary text-sm font-semibold">Room simulator</p>
                  <p className="theme-text-muted mt-2 text-sm">
                    The environment switch changes the stage UI only. Your recording,
                    transcription, feedback, and backend behavior stay the same.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {CALL_ENVIRONMENT_OPTIONS.map((environment) => (
                      <div key={environment.id} className="theme-panel rounded-xl px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="theme-text-primary text-sm font-semibold">
                            {environment.label}
                          </p>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] ${environment.accentClassName}`}
                          >
                            {environment.shortLabel}
                          </span>
                        </div>
                        <p className="theme-text-muted mt-2 text-xs leading-5">
                          {environment.helperText}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="theme-panel-soft rounded-2xl p-4">
                  <p className="theme-text-primary text-sm font-semibold">What happens after a session</p>
                  <p className="theme-text-muted mt-2 text-sm">
                    Speech and video feedback are generated after you stop. If you are signed in,
                    the completed session is also saved to your account.
                  </p>
                </div>

                <div className="theme-panel-soft rounded-2xl p-4">
                  <p className="theme-text-primary text-sm font-semibold">Live articulation</p>
                  <p className="theme-text-muted mt-2 text-sm">
                    Mouth tracking estimates visible articulation during video sessions. It helps
                    with presence and clarity, but it does not score exact pronunciation.
                  </p>
                </div>

                <div className="theme-panel-soft rounded-2xl p-4">
                  <p className="theme-text-primary text-sm font-semibold">Quick practice tips</p>
                  <ul className="theme-text-muted mt-2 space-y-2 text-sm">
                    <li>Keep your face and shoulders visible.</li>
                    <li>Pause briefly before key points.</li>
                    <li>Use full examples instead of one-line answers.</li>
                    <li>Choose audience view when you want public speaking pressure.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
};

export default MockInterview;
