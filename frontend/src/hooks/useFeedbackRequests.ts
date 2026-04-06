import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedbackStatus, TranscriptItem, VisionFrame } from "../components/Interview/types";
import { fetchWithLoopbackFallback } from "../network";

type FeedbackHookArgs = {
  apiBase: string;
  speechEndpoint: string;
  videoEndpoint: string;
  transcripts: TranscriptItem[];
  visionFrames: VisionFrame[];
};

export const useFeedbackRequests = ({
  apiBase,
  speechEndpoint,
  videoEndpoint,
  transcripts,
  visionFrames,
}: FeedbackHookArgs) => {
  const [speechFeedback, setSpeechFeedback] = useState<any>(null);
  const [videoFeedback, setVideoFeedback] = useState<any>(null);
  const [speechFeedbackStatus, setSpeechFeedbackStatus] = useState<FeedbackStatus>("idle");
  const [videoFeedbackStatus, setVideoFeedbackStatus] = useState<FeedbackStatus>("idle");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const sessionStartRef = useRef({ transcriptIndex: 0, visionIndex: 0 });
  const lastSpeechSentRef = useRef<string>("");
  const lastVideoSentRef = useRef<number>(0);
  const transcriptsRef = useRef(transcripts);
  const visionFramesRef = useRef(visionFrames);

  useEffect(() => {
    transcriptsRef.current = transcripts;
  }, [transcripts]);

  useEffect(() => {
    visionFramesRef.current = visionFrames;
  }, [visionFrames]);

  const markSessionStart = useCallback(() => {
    sessionStartRef.current = {
      transcriptIndex: transcriptsRef.current.length,
      visionIndex: visionFramesRef.current.length,
    };
    setSpeechFeedback(null);
    setVideoFeedback(null);
    setSpeechFeedbackStatus("idle");
    setVideoFeedbackStatus("idle");
    setFeedbackError(null);
  }, []);

  const requestSpeechFeedback = useCallback(
    async (text: string, speechKey: string) => {
      setSpeechFeedbackStatus("loading");
      setFeedbackError(null);

      try {
        const response = await fetchWithLoopbackFallback(`${apiBase}${speechEndpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) {
          throw new Error(`Speech feedback failed (${response.status})`);
        }

        const data = await response.json();
        setSpeechFeedback(data);
        setSpeechFeedbackStatus("ready");
        lastSpeechSentRef.current = speechKey;
      } catch (error: any) {
        console.error("Speech feedback error:", error);
        setSpeechFeedbackStatus("error");
        setFeedbackError(error?.message ?? "Failed to fetch speech feedback.");
      }
    },
    [apiBase, speechEndpoint]
  );

  const requestVideoFeedback = useCallback(
    async (frames: VisionFrame[], totalFrameCount: number) => {
      setVideoFeedbackStatus("loading");
      setFeedbackError(null);

      try {
        const response = await fetchWithLoopbackFallback(`${apiBase}${videoEndpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ frames }),
        });

        if (!response.ok) {
          throw new Error(`Video feedback failed (${response.status})`);
        }

        const data = await response.json();
        setVideoFeedback(data);
        setVideoFeedbackStatus("ready");
        lastVideoSentRef.current = totalFrameCount;
      } catch (error: any) {
        console.error("Video feedback error:", error);
        setVideoFeedbackStatus("error");
        setFeedbackError(error?.message ?? "Failed to fetch video feedback.");
      }
    },
    [apiBase, videoEndpoint]
  );

  const requestFeedback = useCallback(async () => {
    const sessionTranscripts = transcriptsRef.current.slice(
      sessionStartRef.current.transcriptIndex
    );
    const sessionText = sessionTranscripts
      .filter((entry) => entry.isFinal)
      .map((entry) => entry.text)
      .join(" ")
      .trim();
    const sessionFrames = visionFramesRef.current.slice(
      sessionStartRef.current.visionIndex
    );
    const totalFrameCount = visionFramesRef.current.length;
    const speechKey = `${sessionStartRef.current.transcriptIndex}:${sessionText}`;

    const requests: Array<Promise<void>> = [];

    if (sessionText && speechKey !== lastSpeechSentRef.current) {
      requests.push(requestSpeechFeedback(sessionText, speechKey));
    } else if (!sessionText) {
      setSpeechFeedbackStatus("idle");
    }

    if (sessionFrames.length > 0 && totalFrameCount !== lastVideoSentRef.current) {
      requests.push(requestVideoFeedback(sessionFrames, totalFrameCount));
    } else if (sessionFrames.length === 0) {
      setVideoFeedbackStatus("idle");
    }

    if (requests.length > 0) {
      await Promise.all(requests);
    }
  }, [requestSpeechFeedback, requestVideoFeedback]);

  return {
    speechFeedback,
    videoFeedback,
    speechFeedbackStatus,
    videoFeedbackStatus,
    feedbackError,
    markSessionStart,
    requestFeedback,
  };
};
