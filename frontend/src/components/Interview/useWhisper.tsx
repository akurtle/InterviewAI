import { useRef, useState } from "react";
import { getWsBase, openWebSocketWithLoopbackFallback } from "../../network";

type WhisperStatus = "idle" | "connecting" | "connected" | "recording" | "error";

interface WhisperCallbacks {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onStatusChange?: (status: WhisperStatus) => void;
  onStartupMetric?: (metric: "asr_socket_ready_ms" | "asr_recording_ready_ms") => void;
}

type WhisperStartOptions = {
  audioDeviceId?: string;
  onPreferredDeviceUnavailable?: () => void;
};

const AUDIO_RECONNECT_DELAYS_MS = [1000, 2000, 5000];
const isRecoverableDeviceSelectionError = (error: unknown) =>
  error instanceof DOMException &&
  (error.name === "NotFoundError" || error.name === "OverconstrainedError");

const buildAudioConstraints = (audioDeviceId?: string, usePreferredDeviceId = true): MediaStreamConstraints => ({
  audio:
    audioDeviceId && usePreferredDeviceId
      ? { deviceId: { exact: audioDeviceId } }
      : true,
});

export function useWhisperWS(
  wsUrl = `${getWsBase()}/asr`,
  callbacks?: WhisperCallbacks
) {
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const lastWordsRef = useRef<string[]>([]);
  const ownsStreamRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const shouldReconnectRef = useRef(false);

  const [partial] = useState("");
  const [finals, setFinals] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<WhisperStatus>("idle");

  const updateStatus = (next: WhisperStatus) => {
    setStatus(next);
    callbacks?.onStatusChange?.(next);
  };

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const stopRecorderOnly = () => {
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
    }
    mediaRef.current = null;
  };

  const getAudioMimeType = () => {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
    for (const candidate of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    }
    return "";
  };

  const cleanupTransport = (stopTracks: boolean) => {
    stopRecorderOnly();

    if (stopTracks) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // The socket may already be closed during reconnect or teardown.
      }
    }
    wsRef.current = null;
  };

  const start = async (providedStream?: MediaStream, options?: WhisperStartOptions) => {
    try {
      clearReconnectTimer();
      updateStatus("connecting");

      shouldReconnectRef.current = true;
      let stream: MediaStream;
      if (providedStream) {
        stream = new MediaStream(providedStream.getAudioTracks());
      } else {
        try {
          stream = await navigator.mediaDevices.getUserMedia(
            buildAudioConstraints(options?.audioDeviceId, true)
          );
        } catch (error) {
          if (!options?.audioDeviceId || !isRecoverableDeviceSelectionError(error)) {
            throw error;
          }

          stream = await navigator.mediaDevices.getUserMedia(
            buildAudioConstraints(options.audioDeviceId, false)
          );
          options.onPreferredDeviceUnavailable?.();
        }
      }

      ownsStreamRef.current = !providedStream;
      streamRef.current = stream;

      if (stream.getAudioTracks().length === 0) {
        throw new Error("No audio track available for transcription.");
      }

      const ws = await openWebSocketWithLoopbackFallback(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;
      callbacks?.onStartupMetric?.("asr_socket_ready_ms");

      ws.onmessage = (event) => {
        const data = JSON.parse(String(event.data));
        const words = data.words ?? [];
        const delta = words.map((word: { word?: string }) => word.word ?? "").join(" ").trim();
        if (!delta) return;

        setFinals((prev) => (prev ? `${prev} ${delta}` : delta));
        callbacks?.onTranscript?.(delta, true);
      };

      ws.onerror = () => {
        updateStatus("error");
      };

      ws.onclose = () => {
        wsRef.current = null;

        if (!shouldReconnectRef.current || !streamRef.current) {
          return;
        }

        const attempt = reconnectAttemptsRef.current;
        const delay =
          AUDIO_RECONNECT_DELAYS_MS[Math.min(attempt, AUDIO_RECONNECT_DELAYS_MS.length - 1)];
        reconnectAttemptsRef.current += 1;
        cleanupTransport(false);
        reconnectTimerRef.current = window.setTimeout(() => {
          void start(streamRef.current ?? undefined, options);
        }, delay);
      };

      updateStatus("connected");

      const mimeType = getAudioMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRef.current = recorder;

      recorder.ondataavailable = async (event) => {
        if (!event.data || event.data.size === 0) return;
        if (ws.readyState !== WebSocket.OPEN) return;
        const buffer = await event.data.arrayBuffer();
        ws.send(buffer);
      };

      recorder.start(250);
      reconnectAttemptsRef.current = 0;
      setIsRunning(true);
      updateStatus("recording");
      callbacks?.onStartupMetric?.("asr_recording_ready_ms");
    } catch (error) {
      console.error("ASR start failed:", error);
      updateStatus("error");
    }
  };

  const stop = () => {
    shouldReconnectRef.current = false;
    clearReconnectTimer();
    setIsRunning(false);
    cleanupTransport(ownsStreamRef.current);
    ownsStreamRef.current = false;
    lastWordsRef.current = [];
    reconnectAttemptsRef.current = 0;
    updateStatus("idle");
  };

  return { start, stop, isRunning, partial, finals, status };
}
