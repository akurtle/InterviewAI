import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth";
import { useWhisperWS } from "../components/Interview/useWhisper";
import type {
  ActiveQuestion,
  CallEnvironmentId,
  GeneratedQuestion,
  MediaDeviceCatalog,
  MediaDeviceSelection,
  QuestionResponseReview,
  QuestionAnswerReview,
  RecordMode,
  SessionRecording,
  TranscriptItem,
  VisionFrame,
} from "../types/interview";
import {
  buildDeviceLabel,
  createEmptyMediaDeviceCatalog,
  getLiveArticulationStats,
  normalizeVisionFrame,
  persistCallEnvironment,
  persistMediaSelection,
  persistMouthTrackingEnabled,
  readStoredCallEnvironment,
  readStoredMediaSelection,
  readStoredMouthTrackingEnabled,
} from "../components/Interview/mockInterviewUtils";
import { useFeedbackRequests } from "./useFeedbackRequests";
import { useSessionType } from "./useSessionType";
import { getApiBase } from "../network";
import { saveInterviewSession } from "../sessionStore";
import type { SessionQuestionContext } from "../types/session";

type SessionSaveStatus = "idle" | "saving" | "saved" | "error";

export const useMockInterviewController = () => {
  const [recordMode, setRecordMode] = useState<RecordMode>("both");
  const [connectionStatus, setConnectionStatus] = useState<string>("idle");
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [interviewStartSignal, setInterviewStartSignal] = useState(0);
  const [visionData, setVisionData] = useState<unknown>(null);
  const [visionFrames, setVisionFrames] = useState<VisionFrame[]>([]);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<QuestionAnswerReview[]>([]);
  const [questionContext, setQuestionContext] = useState<SessionQuestionContext>({
    role: "",
    company: "",
    callType: "",
  });
  const [sessionSaveStatus, setSessionSaveStatus] = useState<SessionSaveStatus>("idle");
  const [sessionSaveMessage, setSessionSaveMessage] = useState<string | null>(null);
  const [sharedMediaStream, setSharedMediaStream] = useState<MediaStream | null>(null);
  const [mediaDevices, setMediaDevices] = useState<MediaDeviceCatalog>(createEmptyMediaDeviceCatalog);
  const [mediaSelection, setMediaSelection] = useState<MediaDeviceSelection>(readStoredMediaSelection);
  const [mouthTrackingEnabled, setMouthTrackingEnabled] = useState<boolean>(
    readStoredMouthTrackingEnabled
  );
  const [isRefreshingMediaDevices, setIsRefreshingMediaDevices] = useState(false);
  const [mediaDeviceMessage, setMediaDeviceMessage] = useState<string | null>(null);
  const [mediaDeviceLabelsAvailable, setMediaDeviceLabelsAvailable] = useState(false);
  const [callEnvironment, setCallEnvironment] = useState<CallEnvironmentId>(readStoredCallEnvironment);
  const [activeQuestion, setActiveQuestion] = useState<ActiveQuestion | null>(null);

  const prevConnectionStatusRef = useRef(connectionStatus);
  const prevAudioRunningRef = useRef(false);
  const sessionStartedAtRef = useRef<number | null>(null);
  const persistedSessionKeyRef = useRef<string>("");
  const sessionRecordingRef = useRef<SessionRecording | null>(null);
  const mediaSelectionRef = useRef(mediaSelection);
  const apiBase = getApiBase();
  const { endpoints, sessionType } = useSessionType();
  const { user, isConfigured: isSupabaseConfigured } = useAuth();

  const handleTranscript = useCallback((text: string, isFinal: boolean) => {
    setTranscripts((prev) => [...prev, { text, isFinal, ts: Date.now() }]);
  }, []);

  const {
    start: startAudio,
    stop: stopAudio,
    isRunning: isAudioRunning,
    status: audioStatus,
  } = useWhisperWS({
    onTranscript: handleTranscript,
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
    generatedQuestions,
    questionAnswers,
    transcripts,
    visionFrames,
  });

  const refreshMediaDevices = useCallback(async (requestAccess = false) => {
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
        Boolean(currentSelection.audioInputId) &&
        nextSelection.audioInputId !== currentSelection.audioInputId;
      const lostVideoSelection =
        Boolean(currentSelection.videoInputId) &&
        nextSelection.videoInputId !== currentSelection.videoInputId;

      if (lostAudioSelection || lostVideoSelection) {
        setMediaSelection(nextSelection);
        setMediaDeviceMessage(
          "A selected external device is no longer available. The app will use your default device until you choose another one."
        );
      } else if (requestAccess && labelsAvailable) {
        setMediaDeviceMessage(
          "Device list updated. Your external microphones and cameras are ready to use."
        );
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
  }, []);

  const beginSession = useCallback(() => {
    sessionStartedAtRef.current = Date.now();
    persistedSessionKeyRef.current = "";
    sessionRecordingRef.current = null;
    setSharedMediaStream(null);
    setSessionSaveStatus("idle");
    setSessionSaveMessage(null);
    markSessionStart();
    setInterviewStartSignal((prev) => prev + 1);
  }, [markSessionStart]);

  const handleVisionData = useCallback((data: unknown) => {
    console.log("Vision data:", data);
    if (
      typeof data === "object" &&
      data !== null &&
      "type" in data &&
      data.type !== "frame"
    ) {
      setVisionData(data);
    }

    const frame = normalizeVisionFrame(data);
    if (!frame) {
      return;
    }

    setVisionFrames((prev) => (prev.length > 500 ? [...prev.slice(-500), frame] : [...prev, frame]));
  }, []);

  const handlePreferredDevicesUnavailable = useCallback(
    (kinds: Array<"audioinput" | "videoinput">) => {
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
    },
    []
  );

  const handleAudioToggle = useCallback(async () => {
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
  }, [
    beginSession,
    handlePreferredDevicesUnavailable,
    isAudioRunning,
    mediaSelection.audioInputId,
    startAudio,
    stopAudio,
  ]);

  const persistSession = useCallback(async () => {
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
      const speechQuestionReviews = Array.isArray(
        (effectiveFeedbackResult.speechFeedback as { question_reviews?: unknown } | null)
          ?.question_reviews
      )
        ? ((effectiveFeedbackResult.speechFeedback as { question_reviews: QuestionResponseReview[] })
            .question_reviews ?? [])
        : [];
      const reviewsByIndex = new Map(
        speechQuestionReviews.map((review) => [review.index, review] as const)
      );

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
          answer_review: reviewsByIndex.get(index) ?? null,
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
      setSessionSaveMessage(error instanceof Error ? error.message : "Failed to save session.");
    }
  }, [
    generatedQuestions,
    isSupabaseConfigured,
    questionAnswers,
    questionContext,
    recordMode,
    requestFeedback,
    sessionType,
    user,
  ]);

  const handleQuestions = useCallback((questions: GeneratedQuestion[]) => {
    setGeneratedQuestions(questions);
    setQuestionAnswers([]);
  }, []);

  const handleCurrentQuestionChange = useCallback(
    (question: GeneratedQuestion | null, index: number, total: number) => {
      if (!question) {
        setActiveQuestion(null);
        return;
      }

      setActiveQuestion({
        text: question.question,
        index,
        total,
      });
    },
    []
  );

  const handleAudioInputSelect = useCallback((audioInputId: string) => {
    setMediaSelection((current) => ({ ...current, audioInputId }));
  }, []);

  const handleVideoInputSelect = useCallback((videoInputId: string) => {
    setMediaSelection((current) => ({ ...current, videoInputId }));
  }, []);

  const handleRecordingReady = useCallback((recording: SessionRecording | null) => {
    sessionRecordingRef.current = recording;
  }, []);

  const articulationStats = useMemo(
    () => getLiveArticulationStats(visionFrames, mouthTrackingEnabled),
    [mouthTrackingEnabled, visionFrames]
  );

  const isSessionLocked = connectionStatus === "connected" || connectionStatus === "connecting";

  useEffect(() => {
    mediaSelectionRef.current = mediaSelection;
    persistMediaSelection(mediaSelection);
  }, [mediaSelection]);

  useEffect(() => {
    persistMouthTrackingEnabled(mouthTrackingEnabled);
  }, [mouthTrackingEnabled]);

  useEffect(() => {
    persistCallEnvironment(callEnvironment);
  }, [callEnvironment]);

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
  }, [refreshMediaDevices]);

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
  }, [
    audioStatus,
    connectionStatus,
    isAudioRunning,
    recordMode,
    sharedMediaStream,
    startAudio,
    stopAudio,
  ]);

  useEffect(() => {
    if (recordMode !== "audio") {
      prevAudioRunningRef.current = isAudioRunning;
      return;
    }

    if (prevAudioRunningRef.current && !isAudioRunning) {
      void persistSession();
    }

    prevAudioRunningRef.current = isAudioRunning;
  }, [isAudioRunning, persistSession, recordMode]);

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
        (connectionStatus === "idle" ||
          connectionStatus === "disconnected" ||
          connectionStatus === "error")
      ) {
        void persistSession();
      }
    }

    prevConnectionStatusRef.current = connectionStatus;
  }, [beginSession, connectionStatus, persistSession, recordMode]);

  return {
    activeQuestion,
    apiBase,
    articulationStats,
    audioStatus,
    callEnvironment,
    connectionStatus,
    endpoints,
    feedbackError,
    generatedQuestions,
    handleAudioInputSelect,
    handleAudioToggle,
    handleCurrentQuestionChange,
    handlePreferredDevicesUnavailable,
    handleQuestions,
    handleRecordingReady,
    handleTranscript,
    handleVideoInputSelect,
    handleVisionData,
    interviewStartSignal,
    isAudioRunning,
    isRefreshingMediaDevices,
    isSessionLocked,
    mediaDeviceLabelsAvailable,
    mediaDeviceMessage,
    mediaDevices,
    mediaSelection,
    mouthTrackingEnabled,
    questionAnswers,
    recordMode,
    refreshMediaDevices,
    sessionSaveMessage,
    sessionSaveStatus,
    sessionType,
    setCallEnvironment,
    setConnectionStatus,
    setMouthTrackingEnabled,
    setQuestionAnswers,
    setQuestionContext,
    setRecordMode,
    setSharedMediaStream,
    speechFeedback,
    speechFeedbackStatus,
    transcripts,
    user,
    videoFeedback,
    videoFeedbackStatus,
    visionData,
    visionFrames,
  };
};
