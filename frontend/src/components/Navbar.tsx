import { Link } from 'react-router-dom';

function Navbar() {
  return (
    <nav className="fixed top-0 w-full bg-black/80 backdrop-blur-sm border-b border-gray-800 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-linear-to-br from-emerald-400 to-teal-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">AI</span>
            </div>
            <span className="text-white font-semibold text-xl">InterviewAI</span>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
             <Link 
              to="/#features"
              className="text-gray-300 hover:text-white transition"
            >
              Features
            </Link>
             <Link 
              to="/#solutions"
              className="text-gray-300 hover:text-white transition"
            >
              Solutions
            </Link>
            <Link 
              to="/#resources"
              className="text-gray-300 hover:text-white transition"
            >
              Resources
            </Link>
          </div>

          {/* Auth Buttons */}
          <div className="flex items-center space-x-4">
            <button className="text-gray-300 hover:text-white transition">
              Log In
            </button>
            <Link 
              to="/get-started"
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg transition"
            >
              Get Started
            </Link>
            
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar