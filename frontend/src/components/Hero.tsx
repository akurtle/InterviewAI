import React from 'react'
import { Link } from 'react-router-dom';

function Hero() {
    return (
        <section className="relative min-h-screen flex items-center justify-center bg-black overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 opacity-30">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500 rounded-full blur-3xl animate-pulse delay-700"></div>
            </div>

            {/* Grid Pattern Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]"></div>

            {/* Content */}
            <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
                {/* Floating Icons */}
                <div className="absolute -top-20 left-10 w-12 h-12 bg-gray-800/50 backdrop-blur rounded-lg flex items-center justify-center animate-float">
                    <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div className="absolute top-40 right-10 w-12 h-12 bg-gray-800/50 backdrop-blur rounded-lg flex items-center justify-center animate-float delay-300">
                    <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                </div>

                <h1 className="text-6xl md:text-7xl font-bold text-white mb-6 leading-tight">
                    Perfect your interviews
                </h1>

                <p className="text-xl text-gray-400 mb-4 max-w-3xl mx-auto">
                    Perfect Your Interview Skills with AI-Powered Feedback
                </p>

                <p className="text-lg text-gray-500 mb-10 max-w-2xl mx-auto">
                    Get instant AI analysis of your interviews and resumes with actionable insights to land your dream job
                </p>



                <Link
                    to="/get-started"
                    className="group relative inline-flex bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all transform hover:scale-105 shadow-lg shadow-emerald-500/50"
                >
                    <span className="flex items-center space-x-2">
                        <span>Get Started</span>
                        <svg className="w-5 h-5 group-hover:translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                    </span>
                </Link>
                
                {/* Stats */}
                <div className="mt-16 flex items-center justify-center space-x-8">
                    <div className="text-center">
                        <p className="text-3xl font-bold text-white">10K+</p>
                        <p className="text-sm text-gray-500">Interviews Analyzed</p>
                    </div>
                    <div className="h-12 w-px bg-gray-800"></div>
                    <div className="text-center">
                        <p className="text-3xl font-bold text-white">95%</p>
                        <p className="text-sm text-gray-500">Success Rate</p>
                    </div>
                    <div className="h-12 w-px bg-gray-800"></div>
                    <div className="text-center">
                        <p className="text-3xl font-bold text-white">24/7</p>
                        <p className="text-sm text-gray-500">AI Support</p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Hero