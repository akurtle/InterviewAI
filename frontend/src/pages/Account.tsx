import { useEffect, useState } from "react";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { useAuth } from "../auth";
import { listInterviewSessions, type StoredInterviewSession } from "../sessionStore";

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

export default function Account() {
  const { user, signOut, isConfigured } = useAuth();
  const [sessions, setSessions] = useState<StoredInterviewSession[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured || !user) {
      setStatus("ready");
      return;
    }

    let cancelled = false;

    void listInterviewSessions()
      .then((rows) => {
        if (cancelled) return;
        setSessions(rows);
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

  return (
    <div className="theme-page-shell">
      <Navbar />

      <section className="relative overflow-hidden px-6 pb-20 pt-32">
        <div className="theme-grid-overlay absolute inset-0 opacity-70" />
        <div className="absolute inset-0 opacity-35">
          <div className="theme-glow-primary absolute left-[10%] top-[16%] h-72 w-72 rounded-full blur-3xl" />
          <div className="theme-glow-secondary absolute bottom-[10%] right-[10%] h-72 w-72 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl">
          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="theme-accent-text text-sm uppercase tracking-[0.24em]">Account</p>
              <h1 className="theme-text-primary mt-3 text-4xl font-bold md:text-5xl">
                Saved interview sessions
              </h1>
              <p className="theme-text-muted mt-3 max-w-2xl text-base">
                {user?.email
                  ? `Signed in as ${user.email}.`
                  : "Sign in to view stored interview history."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void signOut()}
              className="theme-button-secondary rounded-xl px-4 py-2 text-sm font-medium"
            >
              Sign out
            </button>
          </div>

          {!isConfigured && (
            <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4">
              <p className="text-sm text-yellow-100">
                Supabase is not configured. Add the frontend env vars and run the schema in `supabase/schema.sql`.
              </p>
            </div>
          )}

          {status === "loading" && (
            <div className="theme-panel rounded-2xl p-6">
              <p className="theme-text-primary font-semibold">Loading sessions</p>
              <p className="theme-text-muted mt-2 text-sm">Fetching your saved interview history from Supabase.</p>
            </div>
          )}

          {status === "error" && error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm text-red-100">{error}</p>
            </div>
          )}

          {status === "ready" && sessions.length === 0 && (
            <div className="theme-panel rounded-2xl p-8">
              <p className="theme-text-primary text-lg font-semibold">No saved sessions yet</p>
              <p className="theme-text-muted mt-2 text-sm">
                Finish a mock interview or pitch session while signed in and it will appear here automatically.
              </p>
            </div>
          )}

          {sessions.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              {sessions.map((session) => (
                <article key={session.id} className="theme-panel rounded-3xl p-6">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="theme-text-primary text-lg font-semibold">
                        {session.session_type === "pitch" ? "Pitch practice" : "Interview practice"}
                      </p>
                      <p className="theme-text-muted mt-1 text-sm">
                        {formatDateTime(session.created_at)}
                      </p>
                    </div>
                    <span className="theme-chip rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em]">
                      {session.record_mode}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="theme-panel-soft rounded-2xl p-4">
                      <p className="theme-text-dim text-xs uppercase tracking-wide">Questions</p>
                      <p className="theme-text-primary mt-2 text-2xl font-semibold">{session.questions?.length ?? 0}</p>
                    </div>
                    <div className="theme-panel-soft rounded-2xl p-4">
                      <p className="theme-text-dim text-xs uppercase tracking-wide">Transcript items</p>
                      <p className="theme-text-primary mt-2 text-2xl font-semibold">{session.transcripts?.length ?? 0}</p>
                    </div>
                    <div className="theme-panel-soft rounded-2xl p-4">
                      <p className="theme-text-dim text-xs uppercase tracking-wide">Speech score</p>
                      <p className="theme-text-primary mt-2 text-2xl font-semibold">
                        {typeof session.speech_score === "number" ? session.speech_score.toFixed(1) : "N/A"}
                      </p>
                    </div>
                    <div className="theme-panel-soft rounded-2xl p-4">
                      <p className="theme-text-dim text-xs uppercase tracking-wide">Video score</p>
                      <p className="theme-text-primary mt-2 text-2xl font-semibold">
                        {typeof session.video_score === "number" ? session.video_score.toFixed(1) : "N/A"}
                      </p>
                    </div>
                  </div>

                  <div className="theme-border mt-5 border-t pt-4">
                    <p className="theme-text-dim text-xs uppercase tracking-wide">Prompt context</p>
                    <p className="theme-text-secondary mt-2 text-sm">
                      Role: {session.question_context?.role || "N/A"}
                    </p>
                    <p className="theme-text-secondary text-sm">
                      Company: {session.question_context?.company || "N/A"}
                    </p>
                    <p className="theme-text-secondary text-sm">
                      Call type: {session.question_context?.callType || "N/A"}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
