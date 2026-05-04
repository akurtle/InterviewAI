import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import FeedbackPanel from "../components/Interview/FeedbackPanel";
import LiveArticulationPanel from "../components/Interview/LiveArticulationPanel";
import MockInterviewAudioPanel from "../components/Interview/MockInterviewAudioPanel";
import MockInterviewInfoModal from "../components/Interview/MockInterviewInfoModal";
import QuestionGenerator from "../components/Interview/QuestionGenerator";
import SettingsModal from "../components/Interview/SettingsModal";
import WebRTCRecorder from "../components/Interview/WebRTCRecorder";
import { WaveIcon } from "../components/Brand/BrandLogo";
import { useMockInterviewController } from "../hooks/useMockInterviewController";

type AiTab = "coach" | "transcript" | "metrics";
type PracticeMode = "talk" | "interview" | "pitch";

const LIVE_FILLER_WORDS = new Set([
  "um","uh","erm","like","actually","basically","literally","well","so","right","okay","ok",
]);

const formatClock = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
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

  const liveMetrics = useMemo(() => {
    const words = controller.transcripts
      .filter((t) => t.isFinal)
      .flatMap((t) => t.text.trim().split(/\s+/).filter(Boolean));
    const wordCount = words.length;
    const fillerCount = words.filter((w) => LIVE_FILLER_WORDS.has(w.toLowerCase())).length;
    const minutes = elapsedSeconds / 60;
    const hasEnoughData = elapsedSeconds >= 10 && wordCount >= 3;
    return {
      wpm: hasEnoughData ? Math.round(wordCount / minutes) : null,
      fillerPerMin: hasEnoughData ? +(fillerCount / minutes).toFixed(1) : null,
    };
  }, [controller.transcripts, elapsedSeconds]);

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
      ? "Your report is ready. Review the metrics tab for patterns to carry into the next run."
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
                mouthTrackingEnabled={controller.mouthTrackingEnabled}
                selectedAudioInputId={controller.mediaSelection.audioInputId}
                selectedVideoInputId={controller.mediaSelection.videoInputId}
                onPreferredDevicesUnavailable={controller.handlePreferredDevicesUnavailable}
                onStatusChange={(status) => {
                  controller.setConnectionStatus(status);
                }}
                onTranscript={controller.handleTranscript}
                onVisionData={controller.handleVisionData}
                onRecordingReady={controller.handleRecordingReady}
                onStreamReady={controller.setSharedMediaStream}
              />
            )}

            {isLive && (
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="theme-panel-soft rounded-2xl p-4">
                  <p className="theme-text-dim text-xs uppercase tracking-[0.08em]">Pace</p>
                  <p className="theme-text-primary mt-2 text-xl font-semibold">
                    {liveMetrics.wpm != null ? `${liveMetrics.wpm} wpm` : "—"}
                  </p>
                </div>
                <div className="theme-panel-soft rounded-2xl p-4">
                  <p className="theme-text-dim text-xs uppercase tracking-[0.08em]">Clarity</p>
                  <p className="theme-text-primary mt-2 text-xl font-semibold">
                    {controller.articulationStats.statusText}
                  </p>
                </div>
                <div className="theme-panel-soft rounded-2xl p-4">
                  <p className="theme-text-dim text-xs uppercase tracking-[0.08em]">Filler words</p>
                  <p className="theme-text-primary mt-2 text-xl font-semibold">
                    {liveMetrics.fillerPerMin != null ? `${liveMetrics.fillerPerMin}/min` : "—"}
                  </p>
                </div>
              </div>
            )}

            {controller.recordMode !== "audio" && controller.mouthTrackingEnabled && (
              <div className="mt-5">
                <LiveArticulationPanel stats={controller.articulationStats} />
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
          <div className="sticky top-0 z-10 grid grid-cols-3 border-b border-[var(--border)] bg-[var(--bg2)]">
            {(["coach", "transcript", "metrics"] as AiTab[]).map((tab) => (
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

                {practiceMode === "talk" ? (
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
                ) : (
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

            {activeTab === "transcript" && (
              <div className="space-y-3">
                {practiceMode === "talk" ? (
                  (() => {
                    const finalItems = controller.transcripts.filter((t) => t.isFinal);
                    const paragraph = finalItems.map((t) => t.text).join(" ").trim();
                    const durationSec = finalItems.length > 0
                      ? Math.max(0, Math.floor(
                          (finalItems[finalItems.length - 1].ts - finalItems[0].ts) / 1000
                        ))
                      : 0;
                    return paragraph ? (
                      <div className="theme-panel-soft rounded-2xl p-4">
                        <p className="theme-text-dim text-xs mb-2">{formatClock(durationSec)} spoken</p>
                        <p className="theme-text-secondary text-sm leading-[1.7]">{paragraph}</p>
                      </div>
                    ) : (
                      <p className="theme-text-dim pt-8 text-center text-sm">
                        Your transcript will appear here as you speak.
                      </p>
                    );
                  })()
                ) : (
                  (() => {
                    const questions = controller.generatedQuestions;
                    const answers = controller.questionAnswers;
                    // Build per-question transcript from finalized answers first,
                    // then fall back to live tagged transcripts for the current question
                    const answerMap = new Map(answers.map((a) => [a.index, a]));
                    const liveByQuestion = new Map<number, string>();
                    controller.transcripts
                      .filter((t) => t.isFinal && t.questionIndex != null)
                      .forEach((t) => {
                        const qi = t.questionIndex as number;
                        liveByQuestion.set(qi, ((liveByQuestion.get(qi) ?? "") + " " + t.text).trim());
                      });

                    if (questions.length === 0) {
                      return (
                        <p className="theme-text-dim pt-8 text-center text-sm">
                          Generate questions and start the interview to see your transcript here.
                        </p>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        {questions.map((q, idx) => {
                          const answer = answerMap.get(idx);
                          const text = answer
                            ? answer.answerText === "--" ? "" : answer.answerText
                            : liveByQuestion.get(idx) ?? "";
                          return (
                            <div key={idx} className="theme-panel-soft rounded-2xl p-4">
                              <p className="theme-text-dim text-xs uppercase tracking-wide mb-1">
                                Q{idx + 1}
                                {answer?.durationSeconds != null
                                  ? ` · ${formatClock(answer.durationSeconds)}`
                                  : ""}
                              </p>
                              <p className="theme-text-primary text-sm font-semibold mb-2">{q.question}</p>
                              {text ? (
                                <p className="theme-text-secondary text-sm leading-[1.7]">{text}</p>
                              ) : (
                                <p className="theme-text-dim text-sm italic">No answer recorded yet.</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            {activeTab === "metrics" && (() => {
              const sm = controller.speechFeedback?.metrics;
              const sscore = typeof controller.speechFeedback?.score === "number"
                ? controller.speechFeedback.score
                : null;
              const vscore = typeof controller.videoFeedback?.score === "number"
                ? controller.videoFeedback.score
                : null;
              const fillerPerMin =
                sm?.filler_count != null && sm?.total_duration_seconds != null && sm.total_duration_seconds > 0
                  ? (sm.filler_count / (sm.total_duration_seconds / 60)).toFixed(1)
                  : sm?.filler_count != null
                    ? String(sm.filler_count)
                    : null;
              const wpm = sm?.speaking_rate_wpm != null ? Math.round(sm.speaking_rate_wpm) : null;
              const metricsItems: [string, string, string][] = [
                [
                  "Pace",
                  wpm != null ? `${wpm} wpm` : "—",
                  wpm != null
                    ? wpm > 180
                      ? "Slightly fast – aim for 120–150 wpm"
                      : wpm < 110
                        ? "Slightly slow – aim for 120–150 wpm"
                        : "Pace is in the ideal range (120–150 wpm)"
                    : "Complete a session to see your pace",
                ],
                [
                  "Clarity",
                  sscore != null ? `${sscore.toFixed(1)}%` : "—",
                  "Based on vocabulary, sentence length, and flow",
                ],
                [
                  "Filler words",
                  fillerPerMin != null ? `${fillerPerMin}/min` : "—",
                  sm?.filler_rate != null
                    ? sm.filler_rate > 0.05
                      ? "High – replace fillers with brief pauses"
                      : "Low filler usage – well done"
                    : "Complete a session to see filler data",
                ],
                [
                  "Confidence",
                  vscore != null ? `${vscore.toFixed(1)}%` : "—",
                  "Based on eye contact and facial presence",
                ],
              ];
              return (
                <div className="space-y-3">
                  {metricsItems.map(([label, value, note]) => (
                    <div key={label} className="theme-panel-soft rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="theme-text-dim text-xs uppercase tracking-[0.08em]">{label}</p>
                        <p className="theme-text-primary text-2xl font-bold">{value}</p>
                      </div>
                      {value.endsWith("%") && (
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--bg3)]">
                          <div
                            className="h-full rounded-full bg-[var(--accent)]"
                            style={{ width: value }}
                          />
                        </div>
                      )}
                      <p className="theme-text-secondary mt-3 text-xs leading-[1.55]">{note}</p>
                    </div>
                  ))}
                </div>
              );
            })()}
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
        mouthTrackingEnabled={controller.mouthTrackingEnabled}
        onSetMouthTrackingEnabled={controller.setMouthTrackingEnabled}
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
        connectionStatus={controller.connectionStatus}
        visionData={controller.visionData}
      />

      <MockInterviewInfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
    </div>
  );
}

export default MockInterview;
