import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Layout/Navbar";

type PracticeMode = "talk" | "interview" | "pitch";

type ModeCard = {
  mode: PracticeMode;
  title: string;
  description: string;
  className: string;
  storageMode: "interview" | "pitch";
  tags: string[];
  icon: ReactNode;
};

const modeCards: ModeCard[] = [
  {
    mode: "talk",
    title: "Free Talk",
    description:
      "Open-ended speaking practice for warmups, stories, and everyday communication reps.",
    className: "mode-card-talk",
    storageMode: "interview",
    tags: ["Low pressure", "Open prompt", "Live tips"],
    icon: (
      <svg className="h-9 w-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    mode: "interview",
    title: "Interview Prep",
    description:
      "Generate role-specific questions, rehearse answers, and capture transcript-backed feedback.",
    className: "mode-card-interview",
    storageMode: "interview",
    tags: ["Behavioral", "Technical", "Role fit"],
    icon: (
      <svg className="h-9 w-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          d="M9 6h6m-7 5h8m-8 4h5M7 3h10a2 2 0 0 1 2 2v14l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 0 1 2-2Z"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        />
      </svg>
    ),
  },
  {
    mode: "pitch",
    title: "Pitch Practice",
    description:
      "Practice concise positioning, value articulation, and follow-up answers for high-stakes pitches.",
    className: "mode-card-pitch",
    storageMode: "pitch",
    tags: ["Sales", "Demo", "Investor"],
    icon: (
      <svg className="h-9 w-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

function InterviewType() {
  const navigate = useNavigate();

  const handleSelect = (card: ModeCard) => {
    localStorage.setItem("interview_mode", card.storageMode);
    localStorage.setItem("practice_mode", card.mode);
    const typeParam = card.storageMode;
    const practiceParam = card.mode === "talk" ? "&mode=talk" : "";
    navigate(`/mock-interview?type=${typeParam}${practiceParam}`);
  };

  return (
    <div className="theme-page-shell min-h-screen">
      <Navbar />

      <main className="relative overflow-hidden px-6 pb-16 pt-24">
        <div className="absolute inset-0 z-0">
          <div className="theme-glow-primary absolute left-1/3 top-20 h-[420px] w-[520px] rounded-full blur-3xl" />
          <div className="theme-grid-overlay absolute inset-0 opacity-60" />
        </div>

        <div className="relative z-10 mx-auto max-w-[1100px]">
          <Link
            to="/"
            className="theme-ghost-link mb-10 inline-flex items-center gap-2 text-sm transition"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M15 19 8 12l7-7"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
            Back
          </Link>

          <div className="max-w-3xl">
            <p className="theme-text-dim text-sm font-semibold uppercase tracking-[0.08em]">
              Choose your mode
            </p>
            <h1 className="section-heading theme-text-primary mt-4">
              What are you practicing today?
            </h1>
          </div>

          <div className="mt-12 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
            {modeCards.map((card) => (
              <button
                key={card.mode}
                type="button"
                onClick={() => handleSelect(card)}
                className={`mode-card ${card.className} group relative min-h-[320px] overflow-hidden rounded-[20px] p-7 text-left transition`}
              >
                <span className="mode-icon-box mb-7 flex h-14 w-14 items-center justify-center rounded-2xl">
                  {card.icon}
                </span>
                <h2 className="mode-card-title theme-text-primary text-[22px] font-semibold transition">
                  {card.title}
                </h2>
                <p className="theme-text-secondary mt-4 text-sm leading-[1.65]">
                  {card.description}
                </p>
                <div className="mt-7 flex flex-wrap gap-2">
                  {card.tags.map((tag) => (
                    <span
                      key={tag}
                      className="mode-tag rounded-full px-3 py-1 text-[11px] font-semibold"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <span className="mode-card-arrow absolute bottom-7 right-7 text-2xl opacity-0 transition">
                  -&gt;
                </span>
              </button>
            ))}
          </div>

          <div className="theme-panel-soft mt-10 flex flex-col gap-4 rounded-[14px] p-4 sm:flex-row sm:items-center">
            <span className="theme-icon-badge flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M12 18h.01M9.1 9a3 3 0 1 1 5.8 1c-.45.78-1.15 1.22-1.8 1.66-.68.46-1.1.85-1.1 1.84"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </span>
            <p className="theme-text-secondary text-sm leading-[1.65]">
              Not sure where to start? Try <span className="theme-text-primary font-semibold">Free Talk</span>
              {" "}for a quick baseline before moving into structured interview or pitch practice.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default InterviewType;
