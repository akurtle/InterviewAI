import React from "react";
import { useNavigate, Link } from "react-router-dom";
import Navbar from "../components/Layout/Navbar";
import Footer from "../components/Layout/Footer";

const InterviewType: React.FC = () => {
  const navigate = useNavigate();

  const handleSelect = (type: "interview" | "pitch") => {
    localStorage.setItem("interview_mode", type);
    navigate(`/mock-interview?type=${type}`);
  };

  return (
    <div className="theme-page-shell">
      <Navbar />

      <section className="relative overflow-hidden pb-20 pt-32">
        <div className="absolute inset-0 opacity-20">
          <div className="theme-glow-primary absolute left-1/4 top-1/4 h-96 w-96 rounded-full blur-3xl animate-pulse"></div>
          <div className="theme-glow-secondary absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full blur-3xl animate-pulse delay-700"></div>
        </div>
        <div className="theme-grid-overlay absolute inset-0"></div>

        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <div className="mb-6 flex items-center justify-start">
            <Link
              to="/get-started"
              className="theme-ghost-link flex items-center space-x-2 text-sm transition"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back</span>
            </Link>
          </div>
          <div className="mb-12 text-center">
            <h1 className="theme-text-primary mb-4 text-5xl font-bold md:text-6xl">
              Choose Session Type
            </h1>
            <p className="theme-text-muted mx-auto max-w-2xl text-xl">
              Pick the format that matches how you want to practice.
            </p>
          </div>

          <div className="mx-auto max-w-4xl">
            <div className="grid gap-8 md:grid-cols-2">
              <button
                type="button"
                onClick={() => handleSelect("interview")}
                className="theme-panel theme-card-hover group rounded-2xl p-8 text-left transition-all"
              >
                <div className="theme-icon-badge mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                  <svg className="theme-accent-text h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-10 4h6m-6 4h4M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="theme-text-primary mb-2 text-xl font-semibold">Interview</h3>
                <p className="theme-text-muted">
                  Practice standard interview responses with live feedback.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelect("pitch")}
                className="theme-panel theme-card-hover group rounded-2xl p-8 text-left transition-all"
              >
                <div className="theme-icon-badge mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                  <svg className="theme-accent-text h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <h3 className="theme-text-primary mb-2 text-xl font-semibold">Pitch</h3>
                <p className="theme-text-muted">
                  Rehearse a product or sales pitch and get targeted feedback.
                </p>
              </button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default InterviewType;
