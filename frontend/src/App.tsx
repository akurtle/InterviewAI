import GetStarted from './pages/GetStarted'
import Home from './pages/Home'
import { Route, BrowserRouter as Router,Routes } from 'react-router-dom'
import MockInterview from './pages/MockInterview'
import InterviewType from './pages/InterviewType'
import Settings from './pages/Settings'
import { ThemeProvider } from './theme'
import { AuthProvider } from './auth'
import Auth from './pages/Auth'
import Account from './pages/Account'
import ProtectedRoute from './components/ProtectedRoute'

function App() {

  return (
   <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/get-started" element={<GetStarted />} />
            <Route path="/interview-type" element={<InterviewType />} />
            <Route path="/mock-interview" element={<MockInterview />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/account"
              element={
                <ProtectedRoute>
                  <Account />
                </ProtectedRoute>
              }
            />
            <Route
              path="/user"
              element={
                <ProtectedRoute>
                  <Account />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
