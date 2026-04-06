import { useRef, useState } from "react";
import { getWsBase, openWebSocketWithLoopbackFallback } from "../../network";

type WhisperStatus = "idle" | "connecting" | "connected" | "recording" | "error";

interface WhisperCallbacks {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onStatusChange?: (status: WhisperStatus) => void;
}

export function useWhisperWS(
  wsUrl = `${getWsBase()}/asr`,
  callbacks?: WhisperCallbacks
) {
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const lastWordsRef = useRef<string[]>([]);

  const [partial] = useState("");
  const [finals, setFinals] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<WhisperStatus>("idle");

  const updateStatus = (next: WhisperStatus) => {
    setStatus(next);
    callbacks?.onStatusChange?.(next);
  };

  const start = async () => {
    try {
      updateStatus("connecting");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const ws = await openWebSocketWithLoopbackFallback(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;
      ws.addEventListener("error", () => updateStatus("error"));

      ws.onmessage = (event) => {
        const data = JSON.parse(String(event.data));
        const words = data.words ?? [];
        const delta = words.map((word: { word?: string }) => word.word ?? "").join(" ").trim();
        if (!delta) return;

        setFinals((prev) => (prev ? `${prev} ${delta}` : delta));
        callbacks?.onTranscript?.(delta, true);
      };

      updateStatus("connected");

      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRef.current = recorder;

      recorder.ondataavailable = async (event) => {
        if (!event.data || event.data.size === 0) return;
        if (ws.readyState !== WebSocket.OPEN) return;
        const buffer = await event.data.arrayBuffer();
        ws.send(buffer);
      };

      recorder.start(250);
      setIsRunning(true);
      updateStatus("recording");
    } catch (error) {
      console.error("ASR start failed:", error);
      updateStatus("error");
    }
  };

  const stop = () => {
    setIsRunning(false);
    mediaRef.current?.stop();
    mediaRef.current?.stream.getTracks().forEach((track) => track.stop());
    wsRef.current?.close();
    mediaRef.current = null;
    wsRef.current = null;
    lastWordsRef.current = [];
    updateStatus("idle");
  };

  return { start, stop, isRunning, partial, finals, status };
}
