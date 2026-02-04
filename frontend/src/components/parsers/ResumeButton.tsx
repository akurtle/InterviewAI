
function ResumeButton({ handleOptionSelect }: { handleOptionSelect: (option: "interview" | "resume") => void }) {
    return (
        <button
            onClick={() => handleOptionSelect('resume')}
            className="group relative bg-gray-900/50 backdrop-blur border-2 border-gray-800 rounded-2xl p-8 hover:border-emerald-500 transition-all duration-300 hover:transform hover:scale-105 text-left"
        >
            <div className="w-16 h-16 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-emerald-500/20 transition">
                <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            </div>
            <h3 className="text-2xl font-semibold text-white mb-3">Resume Review</h3>
            <p className="text-gray-400 mb-4">
                Upload your resume and receive AI-powered insights on formatting, content quality, keyword optimization, and ATS compatibility.
            </p>
            <div className="flex items-center text-emerald-400 font-medium">
                <span>Get Started</span>
                <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
            </div>
        </button>
    )
}

export default ResumeButton