import { useCallback, useRef, useState } from "react";
import { getWsBase } from "../../network";

type WhisperStatus = "idle" | "connecting" | "connected" | "recording" | "error";

interface WhisperCallbacks {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onStatusChange?: (status: WhisperStatus) => void;
}

type WhisperStartOptions = {
  audioDeviceId?: string;
  onPreferredDeviceUnavailable?: () => void;
};

// ── Browser SpeechRecognition types ──────────────────────────────────────────

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((e: Event) => void) | null;
  onresult: ((e: Event & { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; [j: number]: { transcript?: string } | undefined } | undefined } }) => void) | null;
  onerror: ((e: Event & { error?: string }) => void) | null;
  onend: ((e: Event) => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4096;
const WS_CONNECT_TIMEOUT_MS = 4000;
const BROWSER_SR_RESTART_DELAY_MS = 500;

function getSpeechRecognitionCtor() {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function useWhisperWS(callbacks?: WhisperCallbacks) {
  // Keep callbacks in a ref so audio processor closures always see the latest version
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const shouldRunRef = useRef(false);

  // WebSocket ASR refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const ownedStreamRef = useRef<MediaStream | null>(null);

  // Browser SpeechRecognition fallback refs
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const lastFinalRef = useRef("");

  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<WhisperStatus>("idle");

  const emit = useCallback((next: WhisperStatus) => {
    setStatus(next);
    cbRef.current?.onStatusChange?.(next);
  }, []);

  // ── Cleanup helpers ────────────────────────────────────────────────────────

  const teardownWS = useCallback(() => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    if (ownedStreamRef.current) {
      ownedStreamRef.current.getTracks().forEach((t) => t.stop());
      ownedStreamRef.current = null;
    }
  }, []);

  const teardownBrowserSR = useCallback((abort = false) => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    const r = recognitionRef.current;
    if (!r) return;
    r.onstart = null;
    r.onresult = null;
    r.onerror = null;
    r.onend = null;
    try { abort ? r.abort() : r.stop(); } catch { /* already stopped */ }
    recognitionRef.current = null;
  }, []);

  // ── Browser SpeechRecognition fallback ────────────────────────────────────

  const startBrowserSR = useCallback((options?: WhisperStartOptions) => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      emit("error");
      setIsRunning(false);
      console.warn("useWhisperWS: browser SpeechRecognition unavailable and backend WebSocket unreachable.");
      return;
    }

    teardownBrowserSR(true);
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.maxAlternatives = 1;
    recognitionRef.current = r;

    r.onstart = () => {
      setIsRunning(true);
      emit("recording");
    };

    r.onresult = (event) => {
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = (result?.[0]?.transcript ?? "").trim();
        if (result?.isFinal && transcript) {
          final = `${final} ${transcript}`.trim();
        }
      }
      if (!final || final === lastFinalRef.current) return;
      lastFinalRef.current = final;
      cbRef.current?.onTranscript?.(final, true);
    };

    r.onerror = (event) => {
      if (event.error === "no-speech" && shouldRunRef.current) return;
      emit("error");
    };

    r.onend = () => {
      recognitionRef.current = null;
      if (!shouldRunRef.current) {
        setIsRunning(false);
        emit("idle");
        return;
      }
      emit("connected");
      restartTimerRef.current = window.setTimeout(() => {
        startBrowserSR(options);
      }, BROWSER_SR_RESTART_DELAY_MS);
    };

    try {
      r.start();
    } catch {
      recognitionRef.current = null;
      setIsRunning(false);
      emit("error");
    }
  }, [emit, teardownBrowserSR]);

  // ── WebSocket ASR (primary) ────────────────────────────────────────────────

  const startWSAsr = useCallback(async (stream: MediaStream): Promise<boolean> => {
    const wsBase = getWsBase();
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${wsBase}/asr`);
      ws.binaryType = "arraybuffer";
    } catch {
      return false;
    }

    const connected = await new Promise<boolean>((resolve) => {
      const timer = window.setTimeout(() => resolve(false), WS_CONNECT_TIMEOUT_MS);
      ws.onopen = () => { clearTimeout(timer); resolve(true); };
      ws.onerror = () => { clearTimeout(timer); resolve(false); };
      ws.onclose = () => { clearTimeout(timer); resolve(false); };
    });

    if (!connected) {
      ws.close();
      return false;
    }

    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { type?: string; text?: string };
        if (msg.type === "asr" && msg.text) {
          cbRef.current?.onTranscript?.(msg.text, true);
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      if (shouldRunRef.current) {
        setIsRunning(false);
        emit("idle");
      }
    };

    ws.onerror = () => {
      if (shouldRunRef.current) {
        setIsRunning(false);
        emit("error");
      }
    };

    // Build audio pipeline: stream → AudioContext → ScriptProcessor → WebSocket
    try {
      const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioCtxRef.current = audioCtx;

      const audioOnlyStream = new MediaStream(stream.getAudioTracks());
      const source = audioCtx.createMediaStreamSource(audioOnlyStream);
      sourceRef.current = source;

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const processor = audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!shouldRunRef.current || ws.readyState !== WebSocket.OPEN) return;
        const samples = e.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
          pcm[i] = Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767);
        }
        ws.send(pcm.buffer);
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
    } catch {
      ws.close();
      teardownWS();
      return false;
    }

    setIsRunning(true);
    emit("recording");
    return true;
  }, [emit, teardownWS]);

  // ── Public API ─────────────────────────────────────────────────────────────

  const start = useCallback(async (providedStream?: MediaStream, options?: WhisperStartOptions) => {
    shouldRunRef.current = true;
    teardownWS();
    teardownBrowserSR(true);
    lastFinalRef.current = "";
    emit("connecting");

    // Resolve audio stream
    let stream = providedStream && providedStream.getAudioTracks().length > 0
      ? providedStream
      : null;

    if (!stream) {
      const constraints: MediaStreamConstraints = {
        audio: options?.audioDeviceId
          ? { deviceId: { exact: options.audioDeviceId } }
          : true,
      };
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        ownedStreamRef.current = stream;
      } catch {
        if (options?.audioDeviceId) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            ownedStreamRef.current = stream;
            options.onPreferredDeviceUnavailable?.();
          } catch {
            startBrowserSR(options);
            return;
          }
        } else {
          startBrowserSR(options);
          return;
        }
      }
    }

    // Try WebSocket ASR first; fall back to browser SpeechRecognition
    const wsOk = await startWSAsr(stream);
    if (!wsOk && shouldRunRef.current) {
      // Release owned stream before switching to browser SR (it uses its own mic)
      if (ownedStreamRef.current) {
        ownedStreamRef.current.getTracks().forEach((t) => t.stop());
        ownedStreamRef.current = null;
      }
      startBrowserSR(options);
    }
  }, [emit, startBrowserSR, startWSAsr, teardownBrowserSR, teardownWS]);

  const stop = useCallback(() => {
    shouldRunRef.current = false;
    lastFinalRef.current = "";
    setIsRunning(false);
    teardownWS();
    teardownBrowserSR(false);
    emit("idle");
  }, [emit, teardownBrowserSR, teardownWS]);

  return { start, stop, isRunning, status };
}
