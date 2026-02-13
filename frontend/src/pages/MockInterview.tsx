import React, { useState } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import WebRTCRecorder from "../components/Interview/WebRTCRecorder";
import { useWhisperWS } from "../components/Interview/useWhisper";
import LiveTranscription from "../components/Interview/LiveTranscription";

type RecordMode = "video" | "audio" | "both";

const MockInterview: React.FC = () => {
  const [recordMode, setRecordMode] = useState<RecordMode>("both");
  const [connectionStatus, setConnectionStatus] = useState<string>("idle");
  const [transcripts, setTranscripts] = useState<Array<{ text: string; isFinal: boolean }>>([]);
  const [visionData, setVisionData] = useState<any>(null);

  const handleTranscript = (text: string, isFinal: boolean) => {
    console.log("Transcript:", text, "Final:", isFinal);
    setTranscripts((prev) => [...prev, { text, isFinal }]);
  };


  const { start, stop, isRunning, partial, finals } = useWhisperWS("ws://127.0.0.1:8000/asr");


  const handleVisionData = (data: any) => {
    console.log("Vision data:", data);
    setVisionData(data);
  };

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

          <div className={`grid gap-8 ${recordMode === "audio" ? "lg:grid-cols-1 max-w-4xl mx-auto" : "lg:grid-cols-3"}`}>
            {/* WebRTC Recorder - Takes 2 columns in video mode, full width in audio mode */}
            <div className={recordMode === "audio" ? "" : "lg:col-span-2"}>
              <WebRTCRecorder
                mode={recordMode}
                onStatusChange={(status) => {
                  console.log("Connection status:", status);
                  setConnectionStatus(status);
                }}
                onTranscript={handleTranscript}
                onVisionData={handleVisionData}
              />

              {/* Live Transcript Display */}
              <div>
                {/* <button className="px-3 py-2 rounded-lg border text-sm font-semibold transition border-gray-800 bg-black/20 text-gray-300 hover:bg-gray-900/40" onClick={isRunning ? stop : start}>{isRunning ? "Stop" : "Start"}</button> */}
                <div style={{ opacity: 0.7 }}>{partial}</div>
                <ul className="text-white">{finals}</ul>
              </div>
            </div>

            {/* Controls Panel */}
            <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-2xl p-6 h-fit">
              <h2 className="text-white text-lg font-semibold mb-4">Settings</h2>

              {/* Recording Mode Selector */}
              <div className="mb-6">
                <p className="text-gray-400 text-sm mb-2">Recording mode</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRecordMode("both")}
                    disabled={connectionStatus === "connected"}
                    className={`px-3 py-2 rounded-lg border text-sm font-semibold transition ${recordMode === "both"
                      ? "border-emerald-500/60 bg-emerald-500/10 text-white"
                      : "border-gray-800 bg-black/20 text-gray-300 hover:bg-gray-900/40"
                      } ${connectionStatus === "connected" ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    🎥 Both
                  </button>

                  <button
                    type="button"
                    onClick={() => setRecordMode("video")}
                    disabled={connectionStatus === "connected"}
                    className={`px-3 py-2 rounded-lg border text-sm font-semibold transition ${recordMode === "video"
                      ? "border-emerald-500/60 bg-emerald-500/10 text-white"
                      : "border-gray-800 bg-black/20 text-gray-300 hover:bg-gray-900/40"
                      } ${connectionStatus === "connected" ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    📹 Video
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setRecordMode("audio")}
                    disabled={connectionStatus === "connected"}
                    className={`px-3 py-2 rounded-lg border text-sm font-semibold transition ${recordMode === "audio"
                      ? "border-emerald-500/60 bg-emerald-500/10 text-white"
                      : "border-gray-800 bg-black/20 text-gray-300 hover:bg-gray-900/40"
                      } ${connectionStatus === "connected" ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    🎤 Audio only
                  </button>




                </div>

                {connectionStatus === "connected" && (
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


              {/* 
              <LiveTranscription /> */}
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
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default MockInterview;
