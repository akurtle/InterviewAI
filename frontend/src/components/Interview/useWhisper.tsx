import { useRef, useState } from "react";

type WhisperStatus = "idle" | "connecting" | "connected" | "recording" | "error";

interface WhisperCallbacks {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onStatusChange?: (status: WhisperStatus) => void;
}

type WhisperStartOptions = {
  audioDeviceId?: string;
  onPreferredDeviceUnavailable?: () => void;
};

type SpeechRecognitionAlternativeLike = {
  transcript?: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike | undefined;
};

type SpeechRecognitionResultListLike = {
  length: number;
  [index: number]: SpeechRecognitionResultLike | undefined;
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
};

type SpeechRecognitionErrorEventLike = Event & {
  error?: string;
  message?: string;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: ((event: Event) => void) | null;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const RESTART_DELAY_MS = 500;

const getSpeechRecognitionConstructor = () =>
  window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;

export function useWhisperWS(callbacks?: WhisperCallbacks) {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const shouldRunRef = useRef(false);
  const finalTranscriptBufferRef = useRef("");

  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<WhisperStatus>("idle");

  const updateStatus = (next: WhisperStatus) => {
    setStatus(next);
    callbacks?.onStatusChange?.(next);
  };

  const clearRestartTimer = () => {
    if (restartTimerRef.current) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  };

  const cleanupRecognition = (abort = false) => {
    clearRestartTimer();

    const recognition = recognitionRef.current;
    if (!recognition) {
      return;
    }

    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;

    try {
      if (abort) {
        recognition.abort();
      } else {
        recognition.stop();
      }
    } catch {
      // Browser recognition can throw if it is already stopped.
    }

    recognitionRef.current = null;
  };

  const start = async (_providedStream?: MediaStream, options?: WhisperStartOptions) => {
    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor) {
      updateStatus("error");
      setIsRunning(false);
      console.error("Browser speech recognition is unavailable in this browser.");
      return;
    }

    if (_providedStream || options?.audioDeviceId) {
      console.info(
        "Browser speech recognition uses the browser-selected microphone; MediaStream device binding is not supported."
      );
    }

    shouldRunRef.current = true;
    clearRestartTimer();
    cleanupRecognition(true);
    updateStatus("connecting");

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsRunning(true);
      updateStatus("recording");
    };

    recognition.onresult = (event) => {
      let finalText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript?.trim() ?? "";
        if (result?.isFinal && transcript) {
          finalText = `${finalText} ${transcript}`.trim();
        }
      }

      if (!finalText) {
        return;
      }

      if (finalText === finalTranscriptBufferRef.current) {
        return;
      }

      finalTranscriptBufferRef.current = finalText;
      callbacks?.onTranscript?.(finalText, true);
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech" && shouldRunRef.current) {
        return;
      }

      console.error("Browser speech recognition error:", event.message || event.error || event.type);
      updateStatus("error");
    };

    recognition.onend = () => {
      recognitionRef.current = null;

      if (!shouldRunRef.current) {
        setIsRunning(false);
        updateStatus("idle");
        return;
      }

      updateStatus("connected");
      restartTimerRef.current = window.setTimeout(() => {
        void start(undefined, options);
      }, RESTART_DELAY_MS);
    };

    try {
      recognition.start();
    } catch (error) {
      console.error("Browser speech recognition start failed:", error);
      recognitionRef.current = null;
      setIsRunning(false);
      updateStatus("error");
    }
  };

  const stop = () => {
    shouldRunRef.current = false;
    finalTranscriptBufferRef.current = "";
    setIsRunning(false);
    cleanupRecognition(false);
    updateStatus("idle");
  };

  return { start, stop, isRunning, status };
}
