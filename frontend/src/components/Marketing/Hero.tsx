import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import SoundWave from "./SoundWave";

type HeroMode = {
  title: string;
  description: string;
  className: string;
  to: string;
  storageMode: "interview" | "pitch";
  practiceMode: "talk" | "interview" | "pitch";
  icon: ReactNode;
};

const modes: HeroMode[] = [
  {
    title: "Free Talk",
    description: "Warm up with open-ended coaching.",
    className: "mode-card-talk",
    to: "/mock-interview?type=interview&mode=talk",
    storageMode: "interview",
    practiceMode: "talk",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          d="M7 8h10M7 12h6m-8 8 3.2-3.2H18a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v6.8a3 3 0 0 0 3 3h.2L5 20Z"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        />
      </svg>
    ),
  },
  {
    title: "Interview Prep",
    description: "Practice structured answers live.",
    className: "mode-card-interview",
    to: "/mock-interview?type=interview",
    storageMode: "interview",
    practiceMode: "interview",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          d="M12 3v18m7-9H5m10.5-6.5 3 3m0 0-3 3m3-3h-13"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        />
      </svg>
    ),
  },
  {
    title: "Pitch Practice",
    description: "Sharpen a concise presentation.",
    className: "mode-card-pitch",
    to: "/mock-interview?type=pitch",
    storageMode: "pitch",
    practiceMode: "pitch",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          d="M5 15c3.5-8 8.5-11 14-11-1 5.5-4 10.5-12 14l-2 2v-5Zm8-4 4 4M9 7l8 8"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        />
      </svg>
    ),
  },
];

function persistMode(mode: HeroMode) {
  localStorage.setItem("interview_mode", mode.storageMode);
  localStorage.setItem("practice_mode", mode.practiceMode);
}

function Hero() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pb-14 pt-24">
      <div className="absolute inset-0 z-0">
        <div className="absolute left-1/2 top-[20%] h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-[oklch(0.72_0.18_168_/_0.07)] blur-3xl" />
        <div className="absolute left-1/2 top-[24%] h-[620px] w-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,var(--bg)_42%,transparent_78%)]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center text-center">
        <span className="pill">
          <span className="pill-dot" />
          AI-powered speaking coach
        </span>

        <h1 className="hero-heading mt-8 max-w-4xl theme-text-primary">
          Speak with
          <br />
          <span className="hero-serif theme-accent-text">real confidence.</span>
        </h1>

        <p className="theme-text-secondary mt-7 max-w-[520px] text-[18px] font-light leading-[1.65]">
          TalkItOut AI listens for pace, clarity, filler words, and presence so every practice
          session turns into a sharper next attempt.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/interview-type"
            className="cta-primary rounded-xl px-[34px] py-[15px] text-[15px] font-bold"
          >
            Start talking free -&gt;
          </Link>
          <a
            href="#features"
            className="cta-outline rounded-xl px-[34px] py-[15px] text-[15px] font-semibold"
          >
            Watch demo
          </a>
        </div>

        <div className="mt-12 grid w-full max-w-4xl gap-3 md:grid-cols-3">
          {modes.map((mode) => (
            <Link
              key={mode.title}
              to={mode.to}
              onClick={() => persistMode(mode)}
              className={`mode-card ${mode.className} group flex items-center gap-3 rounded-2xl p-3 text-left transition`}
            >
              <span className="mode-icon-box flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl">
                {mode.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="mode-card-title block text-sm font-semibold text-[var(--txt)]">
                  {mode.title}
                </span>
                <span className="block truncate text-xs text-[var(--txt2)]">{mode.description}</span>
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-[72px] w-full border-t border-[var(--border)] pt-10">
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <p className="theme-text-primary text-[30px] font-bold">12K+</p>
              <p className="theme-text-dim text-sm">Sessions completed</p>
            </div>
            <div>
              <p className="theme-text-primary text-[30px] font-bold">94%</p>
              <p className="theme-text-dim text-sm">Reported improvement</p>
            </div>
            <div>
              <p className="theme-text-primary text-[30px] font-bold">48h</p>
              <p className="theme-text-dim text-sm">Avg. to noticeable change</p>
            </div>
          </div>
        </div>

        <SoundWave />
      </div>
    </section>
  );
}

export default Hero;
