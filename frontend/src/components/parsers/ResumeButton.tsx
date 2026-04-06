function ResumeButton({ handleOptionSelect }: { handleOptionSelect: (option: "interview" | "resume") => void }) {
    return (
        <button
            onClick={() => handleOptionSelect('resume')}
            className="theme-panel theme-card-hover group relative rounded-2xl p-8 text-left backdrop-blur transition-all duration-300 hover:scale-105"
        >
            <div className="theme-icon-badge mb-6 flex h-16 w-16 items-center justify-center rounded-xl transition">
                <svg className="theme-accent-text h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            </div>
            <h3 className="theme-text-primary mb-3 text-2xl font-semibold">Resume Review</h3>
            <p className="theme-text-muted mb-4">
                Upload your resume and receive AI-powered insights on formatting, content quality, keyword optimization, and ATS compatibility.
            </p>
            <div className="theme-accent-text flex items-center font-medium">
                <span>Get Started</span>
                <svg className="ml-2 h-5 w-5 transition group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
            </div>
        </button>
    )
}

export default ResumeButton
