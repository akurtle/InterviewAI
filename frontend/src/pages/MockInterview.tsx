import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import FeedbackPanel from "../components/Interview/FeedbackPanel";
import FreeTalkSpeechPractice from "../components/Interview/FreeTalkSpeechPractice";
import MockInterviewAudioPanel from "../components/Interview/MockInterviewAudioPanel";
import MockInterviewInfoModal from "../components/Interview/MockInterviewInfoModal";
import QuestionGenerator from "../components/Interview/QuestionGenerator";
import SettingsModal from "../components/Interview/SettingsModal";
import WebRTCRecorder from "../components/Interview/WebRTCRecorder";
import { WaveIcon } from "../components/Brand/BrandLogo";
import { useMockInterviewController } from "../hooks/useMockInterviewController";

type AiTab = "coach" | "transcript";
type PracticeMode = "talk" | "interview" | "pitch";

const formatClock = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const transcriptTime = (ts: number, startTs: number | null) => {
  if (!startTs) {
    return "00:00";
  }
  return formatClock(Math.max(0, Math.floor((ts - startTs) / 1000)));
};

function getStoredPracticeMode(search: string): PracticeMode {
  const params = new URLSearchParams(search);
  const mode = params.get("mode");
  const type = params.get("type");
  const storedMode = localStorage.getItem("practice_mode");

  if (mode === "talk") {
    return "talk";
  }

  if (type === "pitch") {
    return "pitch";
  }

  if (type === "interview") {
    return "interview";
  }

  if (storedMode === "talk") {
    return "talk";
  }

  if (storedMode === "pitch") {
    return "pitch";
  }

  return "interview";
}

function MockInterview() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AiTab>("coach");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const controller = useMockInterviewController();
  const navigate = useNavigate();
  const location = useLocation();
  const practiceMode = useMemo(() => getStoredPracticeMode(location.search), [location.search]);
  const isLive =
    controller.connectionStatus === "connecting" ||
    controller.connectionStatus === "connected" ||
    controller.isAudioRunning;
  const transcriptStartTs = controller.transcripts[0]?.ts ?? null;
  const sessionLabel =
    practiceMode === "talk"
      ? "Free Talk"
      : controller.sessionType === "pitch"
        ? "Pitch Practice"
        : "Interview Prep";
  const modeClass =
    practiceMode === "talk"
      ? "mode-card-talk"
      : controller.sessionType === "pitch"
        ? "mode-card-pitch"
        : "mode-card-interview";

  useEffect(() => {
    if (!isLive) {
      return;
    }

    const startedAt = Date.now() - elapsedSeconds * 1000;
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isLive, elapsedSeconds]);

  const coachMessage = isLive
    ? "Keep your answer anchored in one clear point, then support it with a concrete example."
    : controller.speechFeedbackStatus === "ready" || controller.videoFeedbackStatus === "ready"
      ? "Your report is ready. Review the feedback panel for patterns to carry into the next run."
      : "Start your session and I will give you real-time tips as your answer develops.";

  return (
    <div className="h-screen overflow-hidden bg-[var(--bg)] text-[var(--txt)]">
      <header className="grid h-16 grid-cols-[1fr_auto] items-center border-b border-[var(--border)] bg-[var(--bg)] px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="theme-ghost-link inline-flex items-center gap-2 text-sm"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M15 19 8 12l7-7"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
            <span className="hidden sm:inline">Back</span>
          </button>
          <span className="h-6 w-px bg-[var(--border)]" />
          <span className={`mode-icon-box ${modeClass} inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold`}>
            <WaveIcon className="h-4 w-4" />
            {sessionLabel}
          </span>
          <span className="theme-text-dim hidden truncate text-sm md:inline">
            {controller.activeQuestion?.text ?? "Live speaking room"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isLive && (
            <span className="live-badge inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold">
              <span className="live-dot h-2 w-2 rounded-full" />
              {formatClock(elapsedSeconds)}
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsInfoOpen(true)}
            className="cta-outline hidden rounded-xl px-3 py-2 text-sm sm:inline-flex"
          >
            Info
          </button>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="cta-outline rounded-xl px-3 py-2 text-sm"
          >
            Settings
          </button>
        </div>
      </header>

      <main className="grid h-[calc(100vh-64px)] grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_380px] lg:overflow-hidden">
        <section className="overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-5xl">
            {controller.recordMode === "audio" ? (
              <MockInterviewAudioPanel
                audioStatus={controller.audioStatus}
                isAudioRunning={controller.isAudioRunning}
                onToggle={controller.handleAudioToggle}
              />
            ) : (
              <WebRTCRecorder
                mode={controller.recordMode}
                sessionType={controller.sessionType}
                callEnvironment={controller.callEnvironment}
                selectedAudioInputId={controller.mediaSelection.audioInputId}
                selectedVideoInputId={controller.mediaSelection.videoInputId}
                onPreferredDevicesUnavailable={controller.handlePreferredDevicesUnavailable}
                onStatusChange={(status) => {
                  controller.setConnectionStatus(status);
                }}
                onVisionData={controller.handleVisionData}
                onRecordingReady={controller.handleRecordingReady}
                onStreamReady={controller.setSharedMediaStream}
              />
            )}

            {practiceMode === "talk" && (
              <div className="mt-5">
                <FreeTalkSpeechPractice
                  transcripts={controller.transcripts}
                  isLive={isLive}
                />
              </div>
            )}

            <div className="mt-5">
              <FeedbackPanel
                speechFeedback={controller.speechFeedback}
                videoFeedback={controller.videoFeedback}
                speechStatus={controller.speechFeedbackStatus}
                videoStatus={controller.videoFeedbackStatus}
                error={controller.feedbackError}
              />
            </div>
          </div>
        </section>

        <aside className="border-l border-[var(--border)] bg-[var(--bg2)] lg:overflow-y-auto">
          <div className="sticky top-0 z-10 grid grid-cols-2 border-b border-[var(--border)] bg-[var(--bg2)]">
            {(["coach", "transcript"] as AiTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`border-b-2 px-4 py-4 text-sm font-semibold capitalize transition ${
                  activeTab === tab
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "border-transparent text-[var(--txt3)] hover:text-[var(--txt)]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="space-y-5 p-5">
            {activeTab === "coach" && (
              <>
                <div className="rounded-2xl border border-[var(--accent-mid)] bg-[var(--accent-dim)] p-4">
                  <p className="theme-text-primary text-sm leading-[1.65]">{coachMessage}</p>
                </div>

                {practiceMode === "talk" && (
                  <div className="theme-panel-soft rounded-2xl p-4">
                    <p className="theme-text-primary text-sm font-semibold">Quick tips</p>
                    <div className="mt-3 space-y-3">
                      {[
                        "Open with the point you want remembered.",
                        "Pause before changing topics.",
                        "Close each answer with a clear next thought.",
                      ].map((tip) => (
                        <p key={tip} className="theme-text-secondary flex gap-2 text-sm">
                          <span className="theme-accent-text">&rsaquo;</span>
                          {tip}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {controller.sessionSaveMessage && (
                  <div className="theme-panel-soft rounded-2xl p-4">
                    <p
                      className={`text-sm ${
                        controller.sessionSaveStatus === "error"
                          ? "text-red-300"
                          : controller.sessionSaveStatus === "saved"
                            ? "text-[var(--accent)]"
                            : "theme-text-muted"
                      }`}
                    >
                      {controller.sessionSaveMessage}
                    </p>
                  </div>
                )}
              </>
            )}

            {practiceMode !== "talk" && (
              <div className={activeTab !== "coach" ? "hidden" : ""}>
                <QuestionGenerator
                  apiBase={controller.apiBase}
                  endpointPath={controller.endpoints.questions}
                  sessionType={controller.sessionType}
                  onQuestions={controller.handleQuestions}
                  onAnswersChange={controller.setQuestionAnswers}
                  onInputChange={controller.setQuestionContext}
                  transcripts={controller.transcripts}
                  startSignal={controller.interviewStartSignal}
                  onCurrentQuestionChange={controller.handleCurrentQuestionChange}
                />
              </div>
            )}

            {activeTab === "transcript" && (
              <div className="space-y-3">
                {controller.transcripts.length > 0 ? (
                  controller.transcripts.map((item, index) => (
                    <div key={`${item.ts}-${index}`} className="theme-panel-soft rounded-2xl p-4">
                      <p className="theme-text-dim text-xs">
                        {transcriptTime(item.ts, transcriptStartTs)}
                      </p>
                      <p className="theme-text-secondary mt-2 text-sm leading-[1.6]">{item.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="theme-text-dim pt-8 text-center text-sm">
                    Transcript lines will appear here as you speak.
                  </p>
                )}
              </div>
            )}
          </div>
        </aside>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        recordMode={controller.recordMode}
        callEnvironment={controller.callEnvironment}
        onSetCallEnvironment={controller.setCallEnvironment}
        setRecordMode={controller.setRecordMode}
        mediaDevices={controller.mediaDevices}
        mediaSelection={controller.mediaSelection}
        onSelectAudioInput={controller.handleAudioInputSelect}
        onSelectVideoInput={controller.handleVideoInputSelect}
        onRefreshMediaDevices={() => {
          void controller.refreshMediaDevices(!controller.mediaDeviceLabelsAvailable);
        }}
        isRefreshingMediaDevices={controller.isRefreshingMediaDevices}
        mediaDeviceMessage={controller.mediaDeviceMessage}
        mediaDeviceLabelsAvailable={controller.mediaDeviceLabelsAvailable}
        isSessionLocked={controller.isSessionLocked}
      />

      <MockInterviewInfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
    </div>
  );
}

export default MockInterview;
