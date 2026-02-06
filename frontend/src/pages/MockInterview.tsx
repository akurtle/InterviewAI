import React, { useEffect, useMemo, useRef, useState } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

type RecorderState = "idle" | "recording" | "stopped";

const MockInterview: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [recState, setRecState] = useState<RecorderState>("idle");
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRecord = useMemo(() => typeof window !== "undefined" && "MediaRecorder" in window, []);

  const attachStreamToVideo = (stream: MediaStream) => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;
    videoRef.current.play().catch(() => {
      // autoplay can fail; user interaction will start playback
    });
  };

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });

      streamRef.current = stream;
      attachStreamToVideo(stream);
      setCameraOn(true);

      // Default mic toggle state
      stream.getAudioTracks().forEach((t) => (t.enabled = micOn));
    } catch (e: any) {
      setError(e?.message ?? "Could not access camera/microphone.");
      setCameraOn(false);
    }
  };

  const stopCamera = () => {
    // Stop recording if active
    if (recState === "recording") stopRecording();

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (videoRef.current) videoRef.current.srcObject = null;

    setCameraOn(false);
    setRecState("idle");
  };

  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
  };

  const startRecording = () => {
    setError(null);
    if (!streamRef.current) {
      setError("Start the camera first.");
      return;
    }
    if (!canRecord) {
      setError("MediaRecorder is not supported in this browser.");
      return;
    }

    // Cleanup previous recording URL
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    setRecordingUrl(null);

    chunksRef.current = [];
    const mimeType =
      MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
          ? "video/webm;codecs=vp8,opus"
          : "video/webm";

    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (evt) => {
      if (evt.data && evt.data.size > 0) chunksRef.current.push(evt.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setRecordingUrl(url);
      setRecState("stopped");
    };

    recorder.onerror = () => setError("Recording error occurred.");

    recorder.start(); // Start capturing stream data [web:38][web:36]
    setRecState("recording");
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    setRecState("stopped");
  };

  useEffect(() => {
    return () => {
      // cleanup on unmount
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              Turn on your camera and practice. Record a session and upload it later for AI feedback.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Live preview */}
            <div className="lg:col-span-2 bg-gray-900/50 backdrop-blur border border-gray-800 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                <div className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${cameraOn ? "bg-emerald-500" : "bg-gray-600"}`} />
                  <p className="text-white font-semibold">
                    {cameraOn ? "Live feed" : "Camera off"}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">
                    {recState === "recording" ? "Recording…" : recState === "stopped" ? "Recording ready" : "Idle"}
                  </span>
                </div>
              </div>

              <div className="relative aspect-video bg-black">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted // prevent echo during live preview
                />
                {!cameraOn && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center px-6">
                      <div className="w-14 h-14 bg-emerald-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-white font-semibold mb-1">Start your camera</p>
                      <p className="text-gray-400 text-sm">Grant permissions to begin the live mock interview.</p>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="px-6 py-4 border-t border-gray-800">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}
            </div>

            {/* Controls / checklist */}
            <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-2xl p-6">
              <h2 className="text-white text-lg font-semibold mb-4">Controls</h2>

              <div className="space-y-3">
                {!cameraOn ? (
                  <button
                    onClick={startCamera}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 rounded-lg font-semibold transition"
                  >
                    Turn on camera
                  </button>
                ) : (
                  <button
                    onClick={stopCamera}
                    className="w-full bg-gray-800 hover:bg-gray-700 text-white px-4 py-3 rounded-lg font-semibold transition"
                  >
                    Turn off camera
                  </button>
                )}

                <button
                  onClick={toggleMic}
                  disabled={!cameraOn}
                  className={`w-full px-4 py-3 rounded-lg font-semibold transition border ${
                    cameraOn
                      ? "border-emerald-500/40 text-white hover:bg-emerald-500/10"
                      : "border-gray-800 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {micOn ? "Mute microphone" : "Unmute microphone"}
                </button>

                <div className="h-px bg-gray-800 my-2" />

                <button
                  onClick={startRecording}
                  disabled={!cameraOn || recState === "recording"}
                  className={`w-full px-4 py-3 rounded-lg font-semibold transition ${
                    !cameraOn || recState === "recording"
                      ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                      : "bg-emerald-500 hover:bg-emerald-600 text-white"
                  }`}
                >
                  Start recording
                </button>

                <button
                  onClick={stopRecording}
                  disabled={recState !== "recording"}
                  className={`w-full px-4 py-3 rounded-lg font-semibold transition ${
                    recState !== "recording"
                      ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                      : "bg-gray-800 hover:bg-gray-700 text-white"
                  }`}
                >
                  Stop recording
                </button>
              </div>

              <div className="mt-6">
                <h3 className="text-white font-semibold mb-2">Mock interview tips</h3>
                <ul className="text-sm text-gray-400 space-y-2">
                  <li className="border-l-2 border-emerald-500 pl-3">Frame your face and shoulders; eye level camera.</li>
                  <li className="border-l-2 border-emerald-500 pl-3">Answer with STAR (Situation, Task, Action, Result).</li>
                  <li className="border-l-2 border-emerald-500 pl-3">Speak clearly and pause briefly before key points.</li>
                </ul>
              </div>

              {recordingUrl && (
                <div className="mt-6 border-t border-gray-800 pt-6">
                  <h3 className="text-white font-semibold mb-3">Recording preview</h3>
                  <video className="w-full rounded-lg border border-gray-800" src={recordingUrl} controls />
                  <a
                    className="mt-3 inline-block text-emerald-400 hover:text-emerald-300 text-sm"
                    href={recordingUrl}
                    download="mock-interview.webm"
                  >
                    Download recording
                  </a>
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
