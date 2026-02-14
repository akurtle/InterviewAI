// useWhisperWS.ts
import { useRef, useState } from "react";



//  Helps create that connection between REact and fast api by creating web sockets

type WlkMessage =
  | { type: "partial"; text: string }
  | { type: "final"; text: string }
  | { type: string;[k: string]: any };

type WhisperStatus = "idle" | "connecting" | "connected" | "recording" | "error";

interface WhisperCallbacks {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onStatusChange?: (status: WhisperStatus) => void;
}

export function useWhisperWS(
  wsUrl = (import.meta.env.VITE_WS_BASE ?? "ws://localhost:8000") + "/asr",
  callbacks?: WhisperCallbacks
) {
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const lastWordsRef = useRef<string[]>([]);

  const [partial, setPartial] = useState("");
  const [finals, setFinals] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<WhisperStatus>("idle");

  const updateStatus = (next: WhisperStatus) => {
    setStatus(next);
    callbacks?.onStatusChange?.(next);
  };

  const start = async () => {
    console.log("started")
    try {
      updateStatus("connecting");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;
      ws.addEventListener("error", () => updateStatus("error"));

      const overlapLen = (prev: string[], next: string[], max = 20) => {
        const maxK = Math.min(prev.length, next.length, max);
        for (let k = maxK; k >= 1; k--) {
          let ok = true;
          for (let i = 0; i < k; i++) {
            if (prev[prev.length - k + i] !== next[i]) {
              ok = false;
              break;
            }
          }
          if (ok) return k;
        }
        return 0;
      };

        ws.onmessage = (ev) => {
        const data = JSON.parse(String(ev.data));
        const words = data.words ?? [];
        const delta = words.map((w: any) => w.word).join(" ").trim();
        if (!delta) return;

        setFinals((prev) => (prev ? prev + " " + delta : delta));
        callbacks?.onTranscript?.(delta, true);
      };

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => {
          updateStatus("connected");
          resolve();
        };
        ws.onerror = () => reject(new Error("WS failed to open"));
      });

      // webm/opus chunks are what WLK’s web UI uses (server decodes via FFmpeg by default) :contentReference[oaicite:2]{index=2}
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRef.current = rec;

      rec.ondataavailable = async (e) => {
        if (!e.data || e.data.size === 0) return;
        if (ws.readyState !== WebSocket.OPEN) return;
        const buf = await e.data.arrayBuffer();
        ws.send(buf); // send bytes
      };

      rec.start(250); // chunk every 250ms (tune 100–500ms)
      setIsRunning(true);
      updateStatus("recording");
    } catch (error) {
      console.error("ASR start failed:", error);
      updateStatus("error");
    }
  };

  const stop = () => {

    console.log("stopped")
    setIsRunning(false);
    mediaRef.current?.stop();
    mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
    wsRef.current?.close();
    mediaRef.current = null;
    wsRef.current = null;
    lastWordsRef.current = [];
    updateStatus("idle");
  };

  return { start, stop, isRunning, partial, finals, status };
}
