import React, { useEffect, useRef, useState } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import WebRTCRecorder from "../components/Interview/WebRTCRecorder";
import { useWhisperWS } from "../components/Interview/useWhisper";
import QuestionGenerator from "../components/Interview/QuestionGenerator";
import FeedbackPanel from "../components/Interview/FeedbackPanel";
import SettingsModal from "../components/Interview/SettingsModal";
import type { RecordMode, TranscriptItem, VisionFrame } from "../components/Interview/types";
import { useSessionType } from "../hooks/useSessionType";
import { useFeedbackRequests } from "../hooks/useFeedbackRequests";

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

const MockInterview: React.FC = () => {
  const [recordMode, setRecordMode] = useState<RecordMode>("both");
  const [connectionStatus, setConnectionStatus] = useState<string>("idle");
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [interviewStartSignal, setInterviewStartSignal] = useState(0);
  const [visionData, setVisionData] = useState<any>(null);
  const [visionFrames, setVisionFrames] = useState<VisionFrame[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<{
    text: string;
    index: number;
    total: number;
  } | null>(null);

  const prevConnectionStatusRef = useRef(connectionStatus);
  const prevAudioRunningRef = useRef(false);
  const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";
  const WS_BASE = import.meta.env.VITE_WS_BASE ?? API_BASE.replace(/^http/, "ws");
  const { endpoints } = useSessionType();

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
      ].some((value) => value !== undefined && value !== null);

    if (!facePresent && parseOptionalBoolean(frame.face_present ?? frame.facePresent) === null) {
      return null;
    }

    const lookingAtCamera =
      parseOptionalBoolean(frame.looking_at_camera ?? frame.lookingAtCamera) ?? false;
    const smileProb = parseOptionalNumber(frame.smile_prob ?? frame.smileProb);
    const headYaw = parseOptionalNumber(frame.head_yaw ?? frame.headYaw);
    const headPitch = parseOptionalNumber(frame.head_pitch ?? frame.headPitch);

    return {
      timestamp: parseTimestampSeconds(frame.timestamp),
      face_present: facePresent,
      looking_at_camera: facePresent ? lookingAtCamera : false,
      smile_prob: smileProb,
      head_yaw: headYaw,
      head_pitch: headPitch,
    };
  };

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

  const handleAudioToggle = async () => {
    if (isAudioRunning) {
      stopAudio();
      return;
    }
    markSessionStart();
    triggerInterviewStart();
    await startAudio();
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

    if (shouldRun && !isAudioRunning && (audioStatus === "idle" || audioStatus === "error")) {
      void startAudio();
    }

    if (!shouldRun && (isAudioRunning || audioStatus === "connecting")) {
      stopAudio();
    }
  }, [connectionStatus, recordMode, isAudioRunning, audioStatus, startAudio, stopAudio]);

  useEffect(() => {
    if (recordMode !== "audio") {
      prevAudioRunningRef.current = isAudioRunning;
      return;
    }

    if (prevAudioRunningRef.current && !isAudioRunning) {
      void requestFeedback();
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
        markSessionStart();
        triggerInterviewStart();
      }

      if (
        (prevStatus === "connected" || prevStatus === "connecting") &&
        (connectionStatus === "idle" || connectionStatus === "disconnected" || connectionStatus === "error")
      ) {
        void requestFeedback();
      }
    }

    prevConnectionStatusRef.current = connectionStatus;
  }, [connectionStatus, recordMode]);

  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      <section className="relative pt-28 pb-16 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500 rounded-full blur-3xl animate-pulse delay-700" />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[50px_50px]" />

        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-start mb-6">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="text-sm text-gray-400 hover:text-white transition flex items-center space-x-2"
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
              <div className="rounded-2xl border border-emerald-500/30 bg-black/70 backdrop-blur px-4 py-3 shadow-lg">
                <p className="text-xs text-emerald-300 mb-1">
                  Question {activeQuestion.index + 1} of {activeQuestion.total}
                </p>
                <p className="text-sm text-white">{activeQuestion.text}</p>
              </div>
            </div>
          )}
          <div className="flex justify-end mb-6">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="px-4 py-2 rounded-lg border border-gray-800 bg-black/30 text-sm text-gray-200 hover:bg-gray-900/50 transition"
            >
              Open settings
            </button>
          </div>

          <div className={`grid gap-8 ${recordMode === "audio" ? "lg:grid-cols-1 max-w-4xl mx-auto" : "lg:grid-cols-3"}`}>
            {/* WebRTC Recorder - Takes 2 columns in video mode, full width in audio mode */}
            <div className={recordMode === "audio" ? "" : "lg:col-span-2"}>
              {recordMode === "audio" ? (
                <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${audioStatusDot}`} />
                      <div>
                        <p className="text-white font-semibold text-sm">{audioStatusLabel}</p>
                        <p className="text-xs text-gray-400">Audio transcription session</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/30">
                        Audio only
                      </span>
                    </div>
                  </div>

                  <div className="p-12 bg-linear-to-br from-gray-900 to-black flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg
                          className="w-10 h-10 text-emerald-400"
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
                      <p className="text-white font-semibold text-lg">Live Audio Transcription</p>
                      <p className="text-gray-400 text-sm mt-2">
                        {audioStatus === "recording" ? "Listening for your response..." : "Ready when you are"}
                      </p>
                    </div>
                  </div>

                  <div className="px-6 py-4 border-t border-gray-800 bg-black/20">
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
                            ? "bg-gray-800 hover:bg-gray-700 text-white"
                            : "bg-emerald-500 hover:bg-emerald-600 text-white"
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
                  onStatusChange={(status) => {
                    console.log("Connection status:", status);
                    setConnectionStatus(status);
                  }}
                  onTranscript={handleTranscript}
                  onVisionData={handleVisionData}
                />
              )}

              {/* AI Feedback */}
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
          setRecordMode={setRecordMode}
          isSessionLocked={isSessionLocked}
          connectionStatus={connectionStatus}
          visionData={visionData}
        />
      </section>

      <Footer />
    </div>
  );
};

export default MockInterview;
