import { Link } from 'react-router-dom';
import { useAuth } from '../auth';

function Navbar() {
  const { user, signOut } = useAuth();

  return (
    <nav className="theme-nav fixed top-0 z-50 w-full border-b backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="theme-logo flex h-8 w-8 items-center justify-center rounded-lg">
              <span className="text-white font-bold text-lg">AI</span>
            </div>
            <span className="theme-text-primary text-xl font-semibold">InterviewAI</span>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
             <Link 
              to="/#features"
              className="theme-ghost-link transition"
            >
              Features
            </Link>
             <Link 
              to="/#solutions"
              className="theme-ghost-link transition"
            >
              Solutions
            </Link>
            <Link 
              to="/#resources"
              className="theme-ghost-link transition"
            >
              Resources
            </Link>
          </div>

          {/* Auth Buttons */}
          <div className="flex items-center space-x-4">
            <Link
              to="/settings"
              className="theme-button-secondary rounded-lg px-4 py-2 text-sm font-medium"
            >
              Settings
            </Link>
            {user ? (
              <>
                <Link to="/account" className="theme-ghost-link transition">
                  Account
                </Link>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="theme-ghost-link transition"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link to="/auth" className="theme-ghost-link transition">
                Log In
              </Link>
            )}
            <Link 
              to="/get-started"
              className="theme-button-primary rounded-lg px-6 py-2"
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
