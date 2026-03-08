import React from "react";
import { useNavigate, Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const InterviewType: React.FC = () => {
  const navigate = useNavigate();

  const handleSelect = (type: "interview" | "pitch") => {
    localStorage.setItem("interview_mode", type);
    navigate(`/mock-interview?type=${type}`);
  };

  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500 rounded-full blur-3xl animate-pulse delay-700"></div>
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]"></div>

        <div className="relative z-10 max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-start mb-6">
            <Link
              to="/get-started"
              className="text-sm text-gray-400 hover:text-white transition flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back</span>
            </Link>
          </div>
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
              Choose Session Type
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Pick the format that matches how you want to practice.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8">
              <button
                type="button"
                onClick={() => handleSelect("interview")}
                className="group text-left bg-gray-900/50 border border-gray-800 rounded-2xl p-8 hover:border-emerald-500 transition-all"
              >
                <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-10 4h6m-6 4h4M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Interview</h3>
                <p className="text-gray-400">
                  Practice standard interview responses with live feedback.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelect("pitch")}
                className="group text-left bg-gray-900/50 border border-gray-800 rounded-2xl p-8 hover:border-emerald-500 transition-all"
              >
                <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Pitch</h3>
                <p className="text-gray-400">
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
