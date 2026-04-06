import { Link } from 'react-router-dom';

function Hero() {
    return (
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 opacity-30">
                <div className="theme-glow-primary absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse"></div>
                <div className="theme-glow-secondary absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse delay-700"></div>
            </div>

            {/* Grid Pattern Overlay */}
            <div className="theme-grid-overlay absolute inset-0"></div>

            {/* Content */}
            <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
                {/* Floating Icons */}
                <div className="theme-panel-soft absolute -top-20 left-10 flex h-12 w-12 items-center justify-center rounded-lg backdrop-blur animate-float">
                    <svg className="theme-accent-text w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div className="theme-panel-soft absolute top-40 right-10 flex h-12 w-12 items-center justify-center rounded-lg backdrop-blur animate-float delay-300">
                    <svg className="theme-accent-text w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                </div>

                <h1 className="theme-text-primary mb-6 text-6xl font-bold leading-tight md:text-7xl">
                    Perfect your interviews
                </h1>

                <p className="theme-text-secondary mx-auto mb-4 max-w-3xl text-xl">
                    Perfect Your Interview Skills with AI-Powered Feedback
                </p>

                <p className="theme-text-muted mx-auto mb-10 max-w-2xl text-lg">
                    Get instant AI analysis of your interviews and resumes with actionable insights to land your dream job
                </p>



                <Link
                    to="/get-started"
                    className="theme-button-primary group relative inline-flex rounded-lg px-8 py-4 text-lg font-semibold transition-all hover:scale-105"
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
                        <p className="theme-text-primary text-3xl font-bold">10K+</p>
                        <p className="theme-text-muted text-sm">Interviews Analyzed</p>
                    </div>
                    <div className="theme-stat-divider h-12 w-px"></div>
                    <div className="text-center">
                        <p className="theme-text-primary text-3xl font-bold">95%</p>
                        <p className="theme-text-muted text-sm">Success Rate</p>
                    </div>
                    <div className="theme-stat-divider h-12 w-px"></div>
                    <div className="text-center">
                        <p className="theme-text-primary text-3xl font-bold">24/7</p>
                        <p className="theme-text-muted text-sm">AI Support</p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Hero
