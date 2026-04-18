import { useState } from "react";
import Footer from "../components/Layout/Footer";
import Navbar from "../components/Layout/Navbar";
import FeedbackPanel from "../components/Interview/FeedbackPanel";
import LiveArticulationPanel from "../components/Interview/LiveArticulationPanel";
import MockInterviewAudioPanel from "../components/Interview/MockInterviewAudioPanel";
import MockInterviewHeader from "../components/Interview/MockInterviewHeader";
import MockInterviewInfoModal from "../components/Interview/MockInterviewInfoModal";
import QuestionGenerator from "../components/Interview/QuestionGenerator";
import SettingsModal from "../components/Interview/SettingsModal";
import WebRTCRecorder from "../components/Interview/WebRTCRecorder";
import { useMockInterviewController } from "../hooks/useMockInterviewController";

const MockInterview = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const controller = useMockInterviewController();

  return (
    <div className="theme-page-shell">
      <Navbar />

      <section className="relative overflow-hidden pb-16 pt-28">
        <div className="absolute inset-0 opacity-20">
          <div className="theme-glow-primary absolute left-1/4 top-1/4 h-96 w-96 animate-pulse rounded-full blur-3xl" />
          <div className="theme-glow-secondary absolute bottom-1/4 right-1/4 h-96 w-96 animate-pulse rounded-full blur-3xl delay-700" />
        </div>
        <div className="theme-grid-overlay absolute inset-0" />

        <div className="relative z-10 mx-auto max-w-7xl px-6">
          <MockInterviewHeader
            activeQuestion={controller.activeQuestion}
            callEnvironment={controller.callEnvironment}
            onOpenInfo={() => setIsInfoOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onSelectCallEnvironment={controller.setCallEnvironment}
            sessionType={controller.sessionType}
            sessionSaveMessage={controller.sessionSaveMessage}
            sessionSaveStatus={controller.sessionSaveStatus}
            userEmail={controller.user?.email}
          />

          <div
            className={`grid gap-8 ${
              controller.recordMode === "audio"
                ? "mx-auto max-w-4xl lg:grid-cols-1"
                : "lg:grid-cols-3"
            }`}
          >
            <div className={controller.recordMode === "audio" ? "" : "lg:col-span-2"}>
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
                    console.log("Connection status:", status);
                    controller.setConnectionStatus(status);
                  }}
                  onTranscript={controller.handleTranscript}
                  onVisionData={controller.handleVisionData}
                  onRecordingReady={controller.handleRecordingReady}
                  onStreamReady={controller.setSharedMediaStream}
                  onStartupMetric={controller.markStartupMetric}
                />
              )}

              {controller.recordMode !== "audio" && controller.mouthTrackingEnabled && (
                <div className="mt-6">
                  <LiveArticulationPanel stats={controller.articulationStats} />
                </div>
              )}

              <div className="mt-6">
                <FeedbackPanel
                  speechFeedback={controller.speechFeedback}
                  videoFeedback={controller.videoFeedback}
                  speechStatus={controller.speechFeedbackStatus}
                  videoStatus={controller.videoFeedbackStatus}
                  error={controller.feedbackError}
                />
              </div>
            </div>

            <div className="h-fit">
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
          </div>
        </div>

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
          startupMetrics={controller.startupMetrics}
        />

        <MockInterviewInfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
      </section>

      <Footer />
    </div>
  );
};

export default MockInterview;
