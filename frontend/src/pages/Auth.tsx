import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { useAuth } from "../auth";
import { supabase } from "../supabase";

type AuthMode = "signin" | "signup";

export default function Auth() {
  const location = useLocation();
  const { user, isConfigured } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const redirectPath = (location.state as { from?: string } | null)?.from ?? "/user";

  if (user) {
    return <Navigate to={redirectPath} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase || !isConfigured) {
      setStatus("error");
      setMessage("Add your Supabase env vars before using auth.");
      return;
    }

    setStatus("loading");
    setMessage(null);

    const action =
      mode === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });

    const { error } = await action;

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("success");
    setMessage(
      mode === "signin"
        ? "Signed in. Redirecting to your account."
        : "Account created. Check your inbox if email confirmation is enabled."
    );
  };

  const handleGoogleSignIn = async () => {
    if (!supabase || !isConfigured) {
      setStatus("error");
      setMessage("Add your Supabase env vars before using Google sign-in.");
      return;
    }

    setStatus("loading");
    setMessage(null);

    const redirectTo = new URL(redirectPath, window.location.origin).toString();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("success");
    setMessage("Redirecting to Google sign-in.");
  };

  return (
    <div className="theme-page-shell">
      <Navbar />

      <section className="relative overflow-hidden px-6 pb-20 pt-32">
        <div className="theme-grid-overlay absolute inset-0 opacity-70" />
        <div className="absolute inset-0 opacity-35">
          <div className="theme-glow-primary absolute left-[12%] top-[18%] h-72 w-72 rounded-full blur-3xl" />
          <div className="theme-glow-secondary absolute bottom-[12%] right-[12%] h-72 w-72 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="max-w-2xl">
            <p className="theme-accent-text text-sm uppercase tracking-[0.24em]">Supabase Auth</p>
            <h1 className="theme-text-primary mt-4 text-5xl font-bold md:text-6xl">
              Sign in to keep your interview history
            </h1>
            <p className="theme-text-muted mt-5 text-lg">
              Auth is now wired for per-user session storage. Once signed in, completed interview and pitch runs are saved to your Supabase Postgres database.
            </p>

            <div className="mt-8 space-y-3">
              <div className="theme-panel-soft rounded-2xl p-4">
                <p className="theme-text-primary font-semibold">What gets saved</p>
                <p className="theme-text-muted mt-1 text-sm">
                  Questions, transcripts, frame metrics, speech feedback, video feedback, scores, and timestamps.
                </p>
              </div>
              <div className="theme-panel-soft rounded-2xl p-4">
                <p className="theme-text-primary font-semibold">Security model</p>
                <p className="theme-text-muted mt-1 text-sm">
                  Sessions are stored in Supabase with row-level security so each user can only access their own records.
                </p>
              </div>
              <div className="theme-panel-soft rounded-2xl p-4">
                <p className="theme-text-primary font-semibold">Google login</p>
                <p className="theme-text-muted mt-1 text-sm">
                  Google OAuth uses the same Supabase auth session, so saved history and row-level security continue to work without a separate user model.
                </p>
              </div>
            </div>

            {!isConfigured && (
              <div className="mt-8 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4">
                <p className="text-sm text-yellow-100">
                  Supabase is not configured yet. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` in `frontend/.env`, then run the SQL in `supabase/schema.sql`.
                </p>
              </div>
            )}
          </div>

          <div className="theme-panel rounded-[28px] p-8 backdrop-blur">
            <div className="mb-6 flex gap-2">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${mode === "signin" ? "theme-choice-active" : "theme-button-secondary"}`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${mode === "signup" ? "theme-choice-active" : "theme-button-secondary"}`}
              >
                Sign up
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <button
                type="button"
                onClick={() => void handleGoogleSignIn()}
                disabled={status === "loading" || !isConfigured}
                className={`flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3 font-semibold ${
                  status === "loading" || !isConfigured
                    ? "theme-button-secondary cursor-not-allowed opacity-60"
                    : "theme-button-secondary"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-900"
                >
                  G
                </span>
                Continue with Google
              </button>

              <div className="flex items-center gap-3">
                <div className="theme-border h-px flex-1" />
                <span className="theme-text-dim text-xs uppercase tracking-[0.2em]">or</span>
                <div className="theme-border h-px flex-1" />
              </div>

              <div>
                <label className="theme-text-muted text-xs">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="theme-input mt-1 w-full rounded-xl px-4 py-3 text-sm"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label className="theme-text-muted text-xs">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="theme-input mt-1 w-full rounded-xl px-4 py-3 text-sm"
                  placeholder="At least 6 characters"
                  required
                />
              </div>

              {message && (
                <div
                  className={`rounded-xl border p-3 text-sm ${
                    status === "error"
                      ? "border-red-500/30 bg-red-500/10 text-red-200"
                      : status === "success"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                        : "theme-panel-soft theme-text-muted"
                  }`}
                >
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={status === "loading" || !isConfigured}
                className={`w-full rounded-xl px-4 py-3 font-semibold ${
                  status === "loading" || !isConfigured
                    ? "theme-button-secondary cursor-not-allowed opacity-60"
                    : "theme-button-primary"
                }`}
              >
                {status === "loading"
                  ? "Working..."
                  : mode === "signin"
                    ? "Sign in"
                    : "Create account"}
              </button>
            </form>

            <p className="theme-text-muted mt-4 text-sm">
              Need saved history without changing local practice flow? Sign in with Google or email and your next completed session will be stored automatically.
            </p>

            <div className="theme-border mt-6 border-t pt-4">
              <Link to="/get-started" className="theme-ghost-link text-sm transition">
                Continue without signing in
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
