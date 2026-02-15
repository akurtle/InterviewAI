import { useEffect, useMemo, useRef, useState } from "react";


// THIS IS NOT BEING USED 
//  THIS WAS JUST BEING USED FOR TESTING
//  KEEPING IT HERE IN CASE THINGS GO SOUTH UNDER
// 

export default function LiveTranscription() {
  // If you created /asr_text, change this to "/asr_text"
  const WS_URL = useMemo(() => {
    const apiBase = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";
    const wsBase = import.meta.env.VITE_WS_BASE ?? apiBase.replace(/^http/, "ws");
    return `${wsBase}/asr`;
  }, []);

  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState<
    "idle" | "connecting" | "connected" | "recording" | "stopped" | "error"
  >("idle");
  const [error, setError] = useState<string>("");

  const wsRef = useRef<WebSocket | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Pick a supported mime type for THIS browser
  const pickMimeType = () => {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
    ];
    for (const t of candidates) {
      // MediaRecorder might not exist in some browsers
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return ""; // let browser choose
  };

  const cleanup = () => {
    try {
      recRef.current?.stop();
    } catch {}
    recRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    try {
      wsRef.current?.close();
    } catch {}
    wsRef.current = null;
  };

  useEffect(() => {
    return () => cleanup(); // cleanup on unmount
  }, []);

  const start = async () => {
    setError("");
    setStatus("connecting");

    // 1) mic permission + stream
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch (e: any) {
      setStatus("error");
      setError("Mic permission denied or unavailable.");
      return;
    }

    // 2) websocket
    const ws = new WebSocket(WS_URL);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      console.log("[WS] open");
    };

    ws.onerror = () => {
      setStatus("error");
      setError("WebSocket error (check backend running + URL + origin allowlist).");
      console.log("[WS] error");
    };

    ws.onclose = (ev) => {
      console.log("[WS] close", ev.code, ev.reason);
      if (status !== "error") setStatus("stopped");
    };

    ws.onmessage = (event) => {
      // Your backend uses ws.send_text(msg["text"])
      const text = String(event.data || "").trim();
      if (!text) return
      setTranscript((prev) => (prev ? prev + " " + text : text));
    };

    // 3) Wait until WS is actually open before starting recorder
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("WS open timeout")), 5000);
      ws.addEventListener(
        "open",
        () => {
          clearTimeout(t);
          resolve();
        },
        { once: true }
      );
      ws.addEventListener(
        "error",
        () => {
          clearTimeout(t);
          reject(new Error("WS failed"));
        },
        { once: true }
      );
    }).catch((e: any) => {
      setStatus("error");
      setError(e?.message || "WebSocket failed to open.");
      cleanup();
      return;
    });

    // 4) recorder
    const mimeType = pickMimeType();
    console.log("[MediaRecorder] mimeType:", mimeType || "(default)");

    let rec: MediaRecorder;
    try {
      rec = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch (e: any) {
      setStatus("error");
      setError("MediaRecorder failed to start (browser codec not supported).");
      cleanup();
      return;
    }

    recRef.current = rec;

    rec.ondataavailable = async (evt) => {
      if (!evt.data || evt.data.size === 0) return;
      if (ws.readyState !== WebSocket.OPEN) return;

      const buf = await evt.data.arrayBuffer();
      ws.send(buf);
      // debug:
      // console.log("[chunk]", buf.byteLength);
    };

    rec.onerror = () => {
      setStatus("error");
      setError("MediaRecorder error.");
      cleanup();
    };

    rec.start(250);
    setStatus("recording");
  };

  const stop = () => {
    setStatus("stopped");
    cleanup();
  };

  const isRecording = status === "recording";

  return (
    <div className="p-4 text-white">
      <h2 style={{ marginBottom: 8 }}>Live Transcription</h2>

      <div style={{ marginBottom: 12, opacity: 0.8 }}>
        Status: <b>{status}</b>
        {error ? <span style={{ color: "crimson" }}> — {error}</span> : null}
      </div>

      <button onClick={isRecording ? stop : start} className="px-3 py-2 rounded-lg border text-sm font-semibold transition text-white ">
        {isRecording ? "Stop" : "Start"}
      </button>

      <button
        onClick={() => setTranscript("")}
        className="px-3 py-2 rounded-lg border text-sm font-semibold transition text-white "
        disabled={!transcript}
      >
        Clear
      </button>

      <div
            className="
            mt-4
            p-3.5
            border border-gray-300
            min-h-[120px]
            rounded-lg
            bg-gray-50
            whitespace-pre-wrap
            text-white
            "
      >
        {transcript || "Speak to see transcription..."}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
        Tip: If status becomes <b>error</b>, check the console + backend logs.
      </div>
    </div>
  );
}
