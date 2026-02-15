import React, { useEffect, useRef, useState } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import WebRTCRecorder from "../components/Interview/WebRTCRecorder";
import { useWhisperWS } from "../components/Interview/useWhisper";
import QuestionGenerator from "../components/Interview/QuestionGenerator";

type RecordMode = "video" | "audio" | "both";
type FeedbackStatus = "idle" | "loading" | "ready" | "error";

type VisionFrame = {
  timestamp: number;
  face_present: boolean;
  looking_at_camera: boolean;
  smile_prob: number;
  head_yaw: number;
  head_pitch: number;
};

const MockInterview: React.FC = () => {
  const [recordMode, setRecordMode] = useState<RecordMode>("both");
  const [connectionStatus, setConnectionStatus] = useState<string>("idle");
  const [transcripts, setTranscripts] = useState<
    Array<{ text: string; isFinal: boolean; ts: number }>
  >([]);
  const [interviewStartSignal, setInterviewStartSignal] = useState(0);
  const [visionData, setVisionData] = useState<any>(null);
  const [visionFrames, setVisionFrames] = useState<VisionFrame[]>([]);
  const [speechFeedback, setSpeechFeedback] = useState<any>(null);
  const [videoFeedback, setVideoFeedback] = useState<any>(null);
  const [speechFeedbackStatus, setSpeechFeedbackStatus] = useState<FeedbackStatus>("idle");
  const [videoFeedbackStatus, setVideoFeedbackStatus] = useState<FeedbackStatus>("idle");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<{
    text: string;
    index: number;
    total: number;
  } | null>(null);

  const sessionStartRef = useRef({ transcriptIndex: 0, visionIndex: 0 });
  const lastSpeechSentRef = useRef<string>("");
  const lastVideoSentRef = useRef<number>(0);
  const prevConnectionStatusRef = useRef(connectionStatus);
  const prevAudioRunningRef = useRef(false);
  const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";
  const WS_BASE = import.meta.env.VITE_WS_BASE ?? API_BASE.replace(/^http/, "ws");

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



  

  const markSessionStart = () => {
    sessionStartRef.current = {
      transcriptIndex: transcripts.length,
      visionIndex: visionFrames.length,
    };
    setSpeechFeedback(null);
    setVideoFeedback(null);
    setSpeechFeedbackStatus("idle");
    setVideoFeedbackStatus("idle");
    setFeedbackError(null);
  };

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

    let timestamp: number | null = null;
    if (frame.timestamp !== undefined) {
      const numeric = Number(frame.timestamp);
      if (Number.isFinite(numeric)) {
        timestamp = numeric;
      } else if (typeof frame.timestamp === "string") {
        const parsed = Date.parse(frame.timestamp);
        if (!Number.isNaN(parsed)) {
          timestamp = parsed;
        }
      }
    }
    if (timestamp === null) {
      timestamp = Date.now();
    }

    const facePresent =
      frame.face_present ??
      frame.facePresent ??
      frame.face ??
      frame.has_face ??
      frame.hasFace;
    const lookingAtCamera =
      frame.looking_at_camera ?? frame.lookingAtCamera ?? frame.eye_contact ?? frame.eyeContact;
    const smileProb = frame.smile_prob ?? frame.smileProb ?? frame.smile;
    const headYaw = frame.head_yaw ?? frame.headYaw ?? frame.yaw;
    const headPitch = frame.head_pitch ?? frame.headPitch ?? frame.pitch;

    return {
      timestamp,
      face_present: Boolean(facePresent),
      looking_at_camera: Boolean(lookingAtCamera),
      smile_prob: Number(smileProb ?? 0),
      head_yaw: Number(headYaw ?? 0),
      head_pitch: Number(headPitch ?? 0),
    };
  };

  const requestSpeechFeedback = async (text: string, speechKey: string) => {
    setSpeechFeedbackStatus("loading");
    setFeedbackError(null);

    try {
      const response = await fetch(`${API_BASE}/speech/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error(`Speech feedback failed (${response.status})`);
      }

      const data = await response.json();
      setSpeechFeedback(data);
      setSpeechFeedbackStatus("ready");
      lastSpeechSentRef.current = speechKey;
    } catch (error: any) {
      console.error("Speech feedback error:", error);
      setSpeechFeedbackStatus("error");
      setFeedbackError(error?.message ?? "Failed to fetch speech feedback.");
    }
  };

  const requestVideoFeedback = async (frames: VisionFrame[], totalFrameCount: number) => {
    setVideoFeedbackStatus("loading");
    setFeedbackError(null);

    try {

      console.log("video feedbacking")
      const response = await fetch(`${API_BASE}/video/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames }),
      });

      console.log("Here")

      if (!response.ok) {
        throw new Error(`Video feedback failed (${response.status})`);
      }

      const data = await response.json();
      setVideoFeedback(data);
      setVideoFeedbackStatus("ready");
      lastVideoSentRef.current = totalFrameCount;
    } catch (error: any) {
      console.error("Video feedback error:", error);
      setVideoFeedbackStatus("error");
      setFeedbackError(error?.message ?? "Failed to fetch video feedback.");
    }
  };

  const requestFeedback = async () => {
    const sessionTranscripts = transcripts.slice(sessionStartRef.current.transcriptIndex);
    const sessionText = sessionTranscripts
      .filter((entry) => entry.isFinal)
      .map((entry) => entry.text)
      .join(" ")
      .trim();
    const sessionFrames = visionFrames.slice(sessionStartRef.current.visionIndex);
    const totalFrameCount = visionFrames.length;
    const speechKey = `${sessionStartRef.current.transcriptIndex}:${sessionText}`;

    const requests: Array<Promise<void>> = [];

    if (sessionText && speechKey !== lastSpeechSentRef.current) {
      requests.push(requestSpeechFeedback(sessionText, speechKey));
    } else if (!sessionText) {
      setSpeechFeedbackStatus("idle");
    }

    if (sessionFrames.length > 0 && totalFrameCount !== lastVideoSentRef.current) {
      requests.push(requestVideoFeedback(sessionFrames, totalFrameCount));
    } else if (sessionFrames.length === 0) {
      setVideoFeedbackStatus("idle");
    }

    if (requests.length > 0) {
      await Promise.all(requests);
    }
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

  const feedbackBadgeClass = (status: FeedbackStatus) =>
    status === "ready"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      : status === "loading"
        ? "bg-yellow-500/10 text-yellow-300 border-yellow-500/30"
        : status === "error"
          ? "bg-red-500/10 text-red-300 border-red-500/30"
          : "bg-gray-800 text-gray-400 border-gray-700";

  const feedbackBadgeLabel = (status: FeedbackStatus) =>
    status === "ready" ? "Ready" : status === "loading" ? "Loading" : status === "error" ? "Error" : "Idle";

  const speechMetricLabels: Array<{ key: string; label: string }> = [
    { key: "total_words", label: "Total words" },
    { key: "filler_count", label: "Filler count" },
    { key: "filler_rate", label: "Filler rate" },
    { key: "unique_word_ratio", label: "Unique word ratio" },
    { key: "avg_sentence_length", label: "Avg sentence length" },
    { key: "sentence_length_std", label: "Sentence length std" },
    { key: "repetition_rate", label: "Repetition rate" },
    { key: "pause_count", label: "Pause count" },
    { key: "avg_pause_seconds", label: "Avg pause (s)" },
    { key: "long_pause_ratio", label: "Long pause ratio" },
    { key: "pause_rate_per_min", label: "Pause rate/min" },
    { key: "speaking_rate_wpm", label: "Speaking rate (wpm)" },
    { key: "total_duration_seconds", label: "Total duration (s)" },
    { key: "talking_time_seconds", label: "Talking time (s)" },
  ];

  const formatSpeechMetric = (key: string, value: any) => {
    if (value === null || value === undefined) return "N/A";
    const num = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(num)) return String(value);

    if (["filler_rate", "unique_word_ratio", "repetition_rate", "long_pause_ratio"].includes(key)) {
      return `${(num * 100).toFixed(1)}%`;
    }

    if (
      [
        "avg_sentence_length",
        "sentence_length_std",
        "avg_pause_seconds",
        "pause_rate_per_min",
        "speaking_rate_wpm",
        "total_duration_seconds",
        "talking_time_seconds",
      ].includes(key)
    ) {
      return num.toFixed(1);
    }

    return Math.round(num).toString();
  };

  const speechFeedbackScore =
    typeof speechFeedback?.score === "number" ? speechFeedback.score : null;

  const speechMetrics =
    speechFeedback && typeof speechFeedback === "object" ? speechFeedback.metrics ?? null : null;

  const speechWarnings =
    Array.isArray(speechFeedback?.warnings) ? speechFeedback.warnings : [];
  const speechNotes =
    Array.isArray(speechFeedback?.feedback) ? speechFeedback.feedback : [];

  const videoMetricLabels: Array<{ key: string; label: string }> = [
    { key: "frame_count", label: "Frames analyzed" },
    { key: "face_presence_rate", label: "Face presence rate" },
    { key: "gaze_at_camera_rate", label: "Gaze at camera rate" },
    { key: "smile_rate", label: "Smile rate" },
    { key: "avg_smile_prob", label: "Avg smile probability" },
    { key: "head_movement_std", label: "Head movement std" },
    { key: "long_gaze_break_rate", label: "Long gaze break rate" },
    { key: "long_gaze_breaks", label: "Long gaze breaks" },
    { key: "gaze_break_frames", label: "Gaze break frames" },
  ];

  const formatVideoMetric = (key: string, value: any) => {
    if (value === null || value === undefined) return "N/A";
    const num = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(num)) return String(value);

    if (
      ["face_presence_rate", "gaze_at_camera_rate", "smile_rate", "long_gaze_break_rate"].includes(key)
    ) {
      return `${(num * 100).toFixed(1)}%`;
    }

    if (["avg_smile_prob", "head_movement_std"].includes(key)) {
      return num.toFixed(2);
    }

    return Math.round(num).toString();
  };

  const videoFeedbackScore =
    typeof videoFeedback?.score === "number" ? videoFeedback.score : null;
  const videoMetrics =
    videoFeedback && typeof videoFeedback === "object" ? videoFeedback.metrics ?? null : null;
  const videoWarnings =
    Array.isArray(videoFeedback?.warnings) ? videoFeedback.warnings : [];
  const videoNotes =
    Array.isArray(videoFeedback?.feedback) ? videoFeedback.feedback : [];





  const handleVisionData = (data: any) => {
    console.log("Vision data:", data);
    setVisionData(data);
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
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />

        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
              Mock Interview Live
            </h1>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Connect with AI-powered real-time feedback. Your audio and video are streamed live for instant analysis.
            </p>
          </div>
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

                  <div className="p-12 bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
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
              <div className="mt-6 bg-gray-900/50 backdrop-blur border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white text-lg font-semibold">AI feedback</h2>
                  <span className="text-xs text-gray-400">
                    Generated after you stop the session
                  </span>
                </div>

                {feedbackError && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-red-300 text-sm">{feedbackError}</p>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 rounded-lg border border-gray-800 bg-black/30">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-semibold text-sm">Speech feedback</h3>
                      <span
                        className={`text-xs px-2 py-1 rounded border ${feedbackBadgeClass(
                          speechFeedbackStatus
                        )}`}
                      >
                        {feedbackBadgeLabel(speechFeedbackStatus)}
                      </span>
                    </div>

                    {speechFeedbackStatus === "loading" && (
                      <p className="text-sm text-gray-400">Analyzing your transcript...</p>
                    )}
                    {speechFeedbackStatus === "idle" && (
                      <p className="text-sm text-gray-500">
                        Stop the session to generate speech feedback.
                      </p>
                    )}
                    {speechFeedbackStatus === "error" && (
                      <p className="text-sm text-red-300">
                        Unable to fetch speech feedback. Try again after your next run.
                      </p>
                    )}
                    {speechFeedbackStatus === "ready" && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-black/40 px-4 py-3">
                          <div>
                            <p className="text-xs text-gray-400">Overall score</p>
                            <p className="text-2xl font-semibold text-white">
                              {speechFeedbackScore !== null ? speechFeedbackScore.toFixed(1) : "N/A"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Based on transcript</p>
                            <p className="text-xs text-gray-400">
                              {typeof speechMetrics?.total_words === "number"
                                ? `${speechMetrics.total_words} words`
                                : "Word count pending"}
                            </p>
                          </div>
                        </div>

                        {speechNotes.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs uppercase tracking-wide text-gray-500">Key feedback</p>
                            <ul className="space-y-2 text-sm text-gray-200">
                              {speechNotes.map((note: string, index: number) => (
                                <li key={`${index}-${note.slice(0, 12)}`} className="flex gap-2">
                                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                  <span>{note}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {speechMetrics && (
                          <div className="space-y-2">
                            <p className="text-xs uppercase tracking-wide text-gray-500">Metrics</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {speechMetricLabels.map((metric) => (
                                <div
                                  key={metric.key}
                                  className="flex items-center justify-between rounded-lg border border-gray-800 bg-black/40 px-3 py-2"
                                >
                                  <span className="text-xs text-gray-400">{metric.label}</span>
                                  <span className="text-sm text-white">
                                    {formatSpeechMetric(metric.key, speechMetrics?.[metric.key])}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {speechWarnings.length > 0 && (
                          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
                            <p className="text-xs uppercase tracking-wide text-yellow-300 mb-2">Warnings</p>
                            <ul className="space-y-1 text-sm text-yellow-200">
                              {speechWarnings.map((warning: string, index: number) => (
                                <li key={`${index}-${warning.slice(0, 12)}`}>{warning}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {!speechMetrics && speechNotes.length === 0 && speechWarnings.length === 0 && (
                          <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                            {JSON.stringify(speechFeedback, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-lg border border-gray-800 bg-black/30">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-semibold text-sm">Video feedback</h3>
                      <span
                        className={`text-xs px-2 py-1 rounded border ${feedbackBadgeClass(
                          videoFeedbackStatus
                        )}`}
                      >
                        {feedbackBadgeLabel(videoFeedbackStatus)}
                      </span>
                    </div>

                    {videoFeedbackStatus === "loading" && (
                      <p className="text-sm text-gray-400">Reviewing visual cues...</p>
                    )}
                    {videoFeedbackStatus === "idle" && (
                      <p className="text-sm text-gray-500">
                        Stop the session to generate video feedback.
                      </p>
                    )}
                    {videoFeedbackStatus === "error" && (
                      <p className="text-sm text-red-300">
                        Unable to fetch video feedback. Try again after your next run.
                      </p>
                    )}
                    {videoFeedbackStatus === "ready" && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-black/40 px-4 py-3">
                          <div>
                            <p className="text-xs text-gray-400">Overall score</p>
                            <p className="text-2xl font-semibold text-white">
                              {videoFeedbackScore !== null ? videoFeedbackScore.toFixed(1) : "N/A"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Based on video frames</p>
                            <p className="text-xs text-gray-400">
                              {typeof videoMetrics?.frame_count === "number"
                                ? `${videoMetrics.frame_count} frames`
                                : "Frame count pending"}
                            </p>
                          </div>
                        </div>

                        {videoNotes.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs uppercase tracking-wide text-gray-500">Key feedback</p>
                            <ul className="space-y-2 text-sm text-gray-200">
                              {videoNotes.map((note: string, index: number) => (
                                <li key={`${index}-${note.slice(0, 12)}`} className="flex gap-2">
                                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                  <span>{note}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {videoMetrics && (
                          <div className="space-y-2">
                            <p className="text-xs uppercase tracking-wide text-gray-500">Metrics</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {videoMetricLabels.map((metric) => (
                                <div
                                  key={metric.key}
                                  className="flex items-center justify-between rounded-lg border border-gray-800 bg-black/40 px-3 py-2"
                                >
                                  <span className="text-xs text-gray-400">{metric.label}</span>
                                  <span className="text-sm text-white">
                                    {formatVideoMetric(metric.key, videoMetrics?.[metric.key])}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {videoWarnings.length > 0 && (
                          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
                            <p className="text-xs uppercase tracking-wide text-yellow-300 mb-2">Warnings</p>
                            <ul className="space-y-1 text-sm text-yellow-200">
                              {videoWarnings.map((warning: string, index: number) => (
                                <li key={`${index}-${warning.slice(0, 12)}`}>{warning}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {!videoMetrics && videoNotes.length === 0 && videoWarnings.length === 0 && (
                          <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                            {JSON.stringify(videoFeedback, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="h-fit">
              <QuestionGenerator
                apiBase={API_BASE}
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

        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
              className="absolute inset-0 bg-black/70"
              onClick={() => setIsSettingsOpen(false)}
            />
            <div className="relative w-full max-w-3xl bg-gray-900/90 backdrop-blur border border-gray-800 rounded-2xl p-6 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white text-lg font-semibold">Settings</h2>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-gray-800 text-xs text-gray-300 hover:bg-gray-900/40 transition"
                >
                  Close
                </button>
              </div>

              {/* Recording Mode Selector */}
              <div className="mb-6">
                <p className="text-gray-400 text-sm mb-2">Recording mode</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRecordMode("both")}
                    disabled={isSessionLocked}
                    className={`px-3 py-2 rounded-lg border text-sm font-semibold transition ${recordMode === "both"
                      ? "border-emerald-500/60 bg-emerald-500/10 text-white"
                      : "border-gray-800 bg-black/20 text-gray-300 hover:bg-gray-900/40"
                      } ${isSessionLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    ðŸŽ¥ Both
                  </button>

                  <button
                    type="button"
                    onClick={() => setRecordMode("video")}
                    disabled={isSessionLocked}
                    className={`px-3 py-2 rounded-lg border text-sm font-semibold transition ${recordMode === "video"
                      ? "border-emerald-500/60 bg-emerald-500/10 text-white"
                      : "border-gray-800 bg-black/20 text-gray-300 hover:bg-gray-900/40"
                      } ${isSessionLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    ðŸ“¹ Video
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setRecordMode("audio")}
                    disabled={isSessionLocked}
                    className={`px-3 py-2 rounded-lg border text-sm font-semibold transition ${recordMode === "audio"
                      ? "border-emerald-500/60 bg-emerald-500/10 text-white"
                      : "border-gray-800 bg-black/20 text-gray-300 hover:bg-gray-900/40"
                      } ${isSessionLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    ðŸŽ¤ Audio only
                  </button>
                </div>

                {isSessionLocked && (
                  <p className="text-xs text-yellow-400 mt-2">
                    Stop the session to change recording mode
                  </p>
                )}
              </div>

              {/* Connection Status */}
              <div className="mb-6 p-4 bg-black/40 rounded-lg border border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Connection</span>
                  <span
                    className={`inline-flex items-center gap-2 px-2 py-1 rounded text-xs font-semibold ${connectionStatus === "connected"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : connectionStatus === "connecting"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : connectionStatus === "error"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-gray-800 text-gray-400"
                      }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${connectionStatus === "connected"
                        ? "bg-emerald-500 animate-pulse"
                        : connectionStatus === "connecting"
                          ? "bg-yellow-500 animate-pulse"
                          : connectionStatus === "error"
                            ? "bg-red-500"
                            : "bg-gray-600"
                        }`}
                    />
                    {connectionStatus}
                  </span>
                </div>
              </div>

              {/* Interview Tips */}
              <div className="mb-6">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Mock interview tips
                </h3>
                <ul className="text-sm text-gray-400 space-y-2">
                  <li className="border-l-2 border-emerald-500 pl-3">
                    Frame your face and shoulders at eye level
                  </li>
                  <li className="border-l-2 border-emerald-500 pl-3">
                    Use STAR method: Situation, Task, Action, Result
                  </li>
                  <li className="border-l-2 border-emerald-500 pl-3">
                    Speak clearly and pause before key points
                  </li>
                  <li className="border-l-2 border-emerald-500 pl-3">
                    Maintain eye contact with the camera
                  </li>
                  <li className="border-l-2 border-emerald-500 pl-3">
                    Practice active listening and stay engaged
                  </li>
                </ul>
              </div>

              {/* Vision Data Display */}
              {visionData && (
                <div className="border-t border-gray-800 pt-4 mt-4">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Vision Analysis
                  </h3>
                  <div className="bg-black/40 rounded-lg p-3">
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                      {JSON.stringify(visionData, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
};

export default MockInterview;
