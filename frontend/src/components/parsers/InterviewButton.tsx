import { Link } from 'react-router-dom'

function InterviewButton() {
  return (

    <Link to="/interview-type" className='group relative bg-gray-900/50 backdrop-blur border-2 border-gray-800 rounded-2xl p-8 hover:border-emerald-500 transition-all duration-300 hover:transform hover:scale-105 text-left'>
      <div className="w-16 h-16 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-emerald-500/20 transition">
        <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 className="text-2xl font-semibold text-white mb-3">Live Interview Analysis</h3>
     <p className="text-gray-400 mb-4">
  Improve your interview success rate using live AI-driven insights on your responses and communication.
</p>
      <div className="flex items-center text-emerald-400 font-medium">
        <span>Get Started</span>
        <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </div>
    </Link>

  )
}

export default InterviewButton
