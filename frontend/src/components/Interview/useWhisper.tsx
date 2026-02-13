// useWhisperWS.ts
import { useEffect, useRef, useState } from "react";



//  Helps create that connection between REact and fast api by creating web sockets

type WlkMessage =
  | { type: "partial"; text: string }
  | { type: "final"; text: string }
  | { type: string; [k: string]: any };

export function useWhisperWS(wsUrl = "http://localhost:8000/asr") {
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const lastWordsRef = useRef<string[]>([]);

  const [partial, setPartial] = useState("");
  const [finals, setFinals] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);

  const start = async () => { 
    console.log("started")
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;



    ws.onmessage = (ev) => {
      const text = String(ev.data).trim();
      if (!text) return;

      console.log("RECEIVED:", text);

      const words = text.match(/\S+/g) ?? [];
      if (words.length === 0) return;

      const lastWords = lastWordsRef.current;
      let prefixLen = 0;
      const maxPrefix = Math.min(lastWords.length, words.length);
      while (prefixLen < maxPrefix && lastWords[prefixLen] === words[prefixLen]) {
        prefixLen += 1;
      }

      const newWords = words.slice(prefixLen);
      if (newWords.length > 0) {
        const delta = newWords.join(" ");
        setFinals((prev) => (prev ? prev + " " + delta : delta));
      }

      lastWordsRef.current = words;
    };

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
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
  };

  return { start, stop, isRunning, partial, finals };
}
