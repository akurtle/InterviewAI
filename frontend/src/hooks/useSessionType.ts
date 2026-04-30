import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import type { SessionType } from "../types/interview";

type EndpointConfig = {
  questions: string;
  speech: string;
  video: string;
};

const DEFAULT_ENDPOINTS: Record<SessionType, EndpointConfig> = {
  interview: {
    questions: "/questions/generate",
    speech: "/speech/feedback",
    video: "/video/feedback",
  },
  pitch: {
    questions: "/questions/generate",
    speech: "/speech/feedback",
    video: "/video/feedback",
  },
};

export const useSessionType = () => {
  const location = useLocation();
  const modeParam = new URLSearchParams(location.search).get("type");
  const storedMode =
    typeof window !== "undefined" ? localStorage.getItem("interview_mode") : null;

  const sessionType: SessionType =
    (modeParam ?? storedMode ?? "interview").toLowerCase() === "pitch"
      ? "pitch"
      : "interview";

  useEffect(() => {
    if (!modeParam) return;
    localStorage.setItem("interview_mode", sessionType);
  }, [modeParam, sessionType]);

  const endpoints = useMemo(() => DEFAULT_ENDPOINTS[sessionType], [sessionType]);

  return { sessionType, endpoints };
};
