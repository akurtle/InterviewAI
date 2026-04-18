import { Link } from 'react-router-dom'

function InterviewButton() {
  return (
    <Link to="/interview-type" className='theme-panel theme-card-hover group relative rounded-2xl p-8 text-left backdrop-blur transition-all duration-300 hover:scale-105'>
      <div className="theme-icon-badge mb-6 flex h-16 w-16 items-center justify-center rounded-xl transition">
        <svg className="theme-accent-text h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 className="theme-text-primary mb-3 text-2xl font-semibold">Live Interview Analysis</h3>
      <p className="theme-text-muted mb-4">
        Improve your interview success rate using live AI-driven insights on your responses and communication.
      </p>
      <div className="theme-accent-text flex items-center font-medium">
        <span>Get Started</span>
        <svg className="ml-2 h-5 w-5 transition group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </div>
    </Link>

  )
}

export default InterviewButton
