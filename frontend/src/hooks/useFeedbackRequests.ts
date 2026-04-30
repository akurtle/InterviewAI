import { useCallback, useEffect, useRef, useState } from "react";
import type {
  FeedbackStatus,
  GeneratedQuestion,
  QuestionAnswerReview,
  TranscriptItem,
  VisionFrame,
} from "../types/interview";
import { fetchWithLoopbackFallback } from "../network";

type FeedbackHookArgs = {
  apiBase: string;
  speechEndpoint: string;
  videoEndpoint: string;
  generatedQuestions: GeneratedQuestion[];
  questionAnswers: QuestionAnswerReview[];
  transcripts: TranscriptItem[];
  visionFrames: VisionFrame[];
};

type QuestionResponsePayload = {
  index: number;
  question: string;
  category: string | null;
  answer_text: string;
};

export type FeedbackRequestResult = {
  sessionTranscripts: TranscriptItem[];
  sessionText: string;
  sessionFrames: VisionFrame[];
  speechFeedback: any | null;
  videoFeedback: any | null;
  speechStatus: FeedbackStatus;
  videoStatus: FeedbackStatus;
};

export const useFeedbackRequests = ({
  apiBase,
  speechEndpoint,
  videoEndpoint,
  generatedQuestions,
  questionAnswers,
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
  const generatedQuestionsRef = useRef(generatedQuestions);
  const questionAnswersRef = useRef(questionAnswers);
  const transcriptsRef = useRef(transcripts);
  const visionFramesRef = useRef(visionFrames);

  useEffect(() => {
    generatedQuestionsRef.current = generatedQuestions;
  }, [generatedQuestions]);

  useEffect(() => {
    questionAnswersRef.current = questionAnswers;
  }, [questionAnswers]);

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
    async (
      text: string,
      speechKey: string,
      questionResponses: QuestionResponsePayload[]
    ) => {
      setSpeechFeedbackStatus("loading");
      setFeedbackError(null);

      try {
        const response = await fetchWithLoopbackFallback(`${apiBase}${speechEndpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            question_responses: questionResponses,
          }),
        });

        if (!response.ok) {
          throw new Error(`Speech feedback failed (${response.status})`);
        }

        const data = await response.json();
        setSpeechFeedback(data);
        setSpeechFeedbackStatus("ready");
        lastSpeechSentRef.current = speechKey;
        return data;
      } catch (error: any) {
        console.error("Speech feedback error:", error);
        setSpeechFeedbackStatus("error");
        setFeedbackError(error?.message ?? "Failed to fetch speech feedback.");
        return null;
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
        return data;
      } catch (error: any) {
        console.error("Video feedback error:", error);
        setVideoFeedbackStatus("error");
        setFeedbackError(error?.message ?? "Failed to fetch video feedback.");
        return null;
      }
    },
    [apiBase, videoEndpoint]
  );

  const requestFeedback = useCallback(async (): Promise<FeedbackRequestResult | null> => {
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
    const questionResponses = questionAnswersRef.current.reduce<QuestionResponsePayload[]>(
      (items, answer) => {
        const question = generatedQuestionsRef.current[answer.index];
        const answerText = answer.answerText?.trim();
        if (!question || !answerText || answerText === "--") {
          return items;
        }

        items.push({
          index: answer.index,
          question: question.question,
          category: question.category ?? null,
          answer_text: answerText,
        });

        return items;
      },
      []
    );
    const speechKey = JSON.stringify({
      transcriptIndex: sessionStartRef.current.transcriptIndex,
      sessionText,
      questionResponses: questionResponses.map((item) => ({
        index: item.index,
        answer_text: item.answer_text,
      })),
    });

    let nextSpeechFeedback: any | null = null;
    let nextVideoFeedback: any | null = null;
    let nextSpeechStatus: FeedbackStatus = "idle";
    let nextVideoStatus: FeedbackStatus = "idle";

    if ((sessionText || questionResponses.length > 0) && speechKey !== lastSpeechSentRef.current) {
      nextSpeechFeedback = await requestSpeechFeedback(sessionText, speechKey, questionResponses);
      nextSpeechStatus = nextSpeechFeedback ? "ready" : "error";
    } else if (!sessionText && questionResponses.length === 0) {
      setSpeechFeedbackStatus("idle");
      nextSpeechStatus = "idle";
    } else {
      nextSpeechFeedback = speechFeedback;
      nextSpeechStatus = speechFeedback ? "ready" : "idle";
    }

    if (sessionFrames.length > 0 && totalFrameCount !== lastVideoSentRef.current) {
      nextVideoFeedback = await requestVideoFeedback(sessionFrames, totalFrameCount);
      nextVideoStatus = nextVideoFeedback ? "ready" : "error";
    } else if (sessionFrames.length === 0) {
      setVideoFeedbackStatus("idle");
      nextVideoStatus = "idle";
    } else {
      nextVideoFeedback = videoFeedback;
      nextVideoStatus = videoFeedback ? "ready" : "idle";
    }

    if (!sessionText && questionResponses.length === 0 && sessionFrames.length === 0) {
      return null;
    }

    return {
      sessionTranscripts,
      sessionText,
      sessionFrames,
      speechFeedback: nextSpeechFeedback,
      videoFeedback: nextVideoFeedback,
      speechStatus: nextSpeechStatus,
      videoStatus: nextVideoStatus,
    };
  }, [requestSpeechFeedback, requestVideoFeedback, speechFeedback, videoFeedback]);

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
