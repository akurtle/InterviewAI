import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth";
import {
  getInterviewSession,
  getInterviewSessionRecordingUrl,
  listInterviewSessionAnswers,
  listInterviewSessions,
  type StoredInterviewSession,
  type StoredInterviewSessionAnswer,
  type StoredInterviewSessionSummary,
} from "../sessionStore";

type Status = "loading" | "ready" | "error";
type DetailStatus = "idle" | "loading" | "ready" | "error";
type RecordingStatus = "idle" | "loading" | "ready" | "error";

export const useAccountPage = () => {
  const { user, signOut, isConfigured } = useAuth();
  const [sessions, setSessions] = useState<StoredInterviewSessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<StoredInterviewSession | null>(null);
  const [selectedSessionAnswers, setSelectedSessionAnswers] = useState<
    StoredInterviewSessionAnswer[]
  >([]);
  const [status, setStatus] = useState<Status>("loading");
  const [detailStatus, setDetailStatus] = useState<DetailStatus>("idle");
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>("idle");
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured || !user) {
      setSessions([]);
      setSelectedSessionId(null);
      setSelectedSession(null);
      setSelectedSessionAnswers([]);
      setStatus("ready");
      setDetailStatus("idle");
      setRecordingStatus("idle");
      setRecordingUrl(null);
      setError(null);
      setRecordingError(null);
      return;
    }

    let cancelled = false;
    setStatus("loading");

    void listInterviewSessions(user.id)
      .then((rows) => {
        if (cancelled) return;

        setSessions(rows);
        setSelectedSessionId((current) =>
          current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null
        );
        setError(null);
        setStatus("ready");
      })
      .catch((nextError: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setError(nextError instanceof Error ? nextError.message : "Failed to load saved sessions.");
      });

    return () => {
      cancelled = true;
    };
  }, [isConfigured, user]);

  useEffect(() => {
    if (!isConfigured || !user || !selectedSessionId) {
      setSelectedSession(null);
      setSelectedSessionAnswers([]);
      setDetailStatus("idle");
      return;
    }

    let cancelled = false;
    setSelectedSession(null);
    setSelectedSessionAnswers([]);
    setDetailStatus("loading");
    setError(null);

    void Promise.all([
      getInterviewSession(selectedSessionId, user.id),
      listInterviewSessionAnswers(selectedSessionId, user.id),
    ])
      .then(([session, answers]) => {
        if (cancelled) return;
        setSelectedSession(session);
        setSelectedSessionAnswers(answers);
        setError(null);
        setDetailStatus("ready");
      })
      .catch((nextError: unknown) => {
        if (cancelled) return;
        setDetailStatus("error");
        setError(
          nextError instanceof Error ? nextError.message : "Failed to load the selected session."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [isConfigured, selectedSessionId, user]);

  useEffect(() => {
    if (!selectedSession?.recording_path || !selectedSession.recording_bucket) {
      setRecordingUrl(null);
      setRecordingError(null);
      setRecordingStatus("idle");
      return;
    }

    let cancelled = false;
    setRecordingUrl(null);
    setRecordingStatus("loading");
    setRecordingError(null);

    void getInterviewSessionRecordingUrl(selectedSession)
      .then((url) => {
        if (cancelled) return;
        setRecordingUrl(url);
        setRecordingStatus(url ? "ready" : "idle");
      })
      .catch((nextError: unknown) => {
        if (cancelled) return;
        setRecordingUrl(null);
        setRecordingStatus("error");
        setRecordingError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to load the saved session recording."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSession]);

  const handleSessionSelect = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId);
  }, []);

  return {
    detailStatus,
    error,
    isConfigured,
    recordingError,
    recordingStatus,
    recordingUrl,
    selectedSession,
    selectedSessionAnswers,
    selectedSessionId,
    sessions,
    signOut,
    status,
    user,
    handleSessionSelect,
  };
};
