import { Link } from "react-router-dom";
import type { ReactNode } from "react";

type Feature = {
  tag: string;
  title: string;
  description: string;
  icon: ReactNode;
  highlighted?: boolean;
};

const features: Feature[] = [
  {
    tag: "Live",
    title: "Real-time speech analysis",
    description:
      "See pacing, articulation, and filler-word signals while your answer is still fresh.",
    highlighted: true,
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          d="M4 12h3l2-6 4 12 2-6h5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        />
      </svg>
    ),
  },
  {
    tag: "Smart",
    title: "AI coaching feedback",
    description:
      "Turn each session into clear next steps for structure, specificity, and delivery.",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          d="M12 3 4 7l8 4 8-4-8-4Zm-8 8 8 4 8-4M4 15l8 4 8-4"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        />
      </svg>
    ),
  },
  {
    tag: "Track",
    title: "Progress over time",
    description:
      "Review saved sessions and spot the moments where your speaking habits improve.",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          d="M4 19V5m0 14h16M8 16v-4m4 4V8m4 8v-6"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        />
      </svg>
    ),
  },
  {
    tag: "Contexts",
    title: "Multiple contexts",
    description:
      "Switch between open talk, interview prep, pitch rehearsal, and resume-backed prompts.",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          d="M6 6h6v6H6V6Zm6 6h6v6h-6v-6ZM6 16h2m10-8h-2m-5 11v-2M13 5V3"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        />
      </svg>
    ),
  },
];

function Features() {
  return (
    <>
      <section id="features" className="px-6 py-[100px]">
        <div className="mx-auto max-w-[1100px]">
          <div className="max-w-3xl">
            <span className="pill">How it works</span>
            <h2 className="section-heading theme-text-primary mt-5">
              Every word. Every pause. Every opportunity.
            </h2>
          </div>

          <div className="mt-12 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
            {features.map((feature) => (
              <article
                key={feature.title}
                className={`relative rounded-2xl border border-[var(--border)] p-6 ${
                  feature.highlighted ? "bg-[var(--accent-dim)]" : "bg-[var(--bg2)]"
                }`}
              >
                <div className="mb-8 flex items-start justify-between gap-4">
                  <span className="theme-icon-badge flex h-10 w-10 items-center justify-center rounded-xl">
                    {feature.icon}
                  </span>
                  <span className="theme-chip rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                    {feature.tag}
                  </span>
                </div>
                <h3 className="theme-text-primary text-lg font-semibold">{feature.title}</h3>
                <p className="theme-text-secondary mt-3 text-sm leading-[1.65]">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="px-6 pb-24">
        <div className="mx-auto max-w-[600px] rounded-3xl border border-[var(--accent-mid)] bg-[linear-gradient(135deg,var(--accent-dim),var(--bg2))] px-6 py-10 text-center shadow-[0_22px_60px_oklch(0.03_0.02_220_/_0.28)] sm:px-10">
          <h2 className="section-heading theme-text-primary">Ready to find your voice?</h2>
          <p className="theme-text-secondary mx-auto mt-4 max-w-md text-sm leading-[1.65]">
            Start with a free practice mode, then bring in interview prompts, resume context, and
            saved-session review when you need more structure.
          </p>
          <Link
            to="/interview-type"
            className="cta-primary mt-7 inline-flex rounded-xl px-[34px] py-[15px] text-[15px] font-bold"
          >
            Start talking free -&gt;
          </Link>
        </div>
      </section>
    </>
  );
}

export default Features;
