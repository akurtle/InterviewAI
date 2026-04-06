import GetStarted from './pages/GetStarted'
import Home from './pages/Home'
import { Route, BrowserRouter as Router,Routes } from 'react-router-dom'
import MockInterview from './pages/MockInterview'
import InterviewType from './pages/InterviewType'
import Settings from './pages/Settings'
import { ThemeProvider } from './theme'

function App() {

  return (
   <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/get-started" element={<GetStarted />} />
          <Route path="/interview-type" element={<InterviewType />} />
          <Route path="/mock-interview" element={<MockInterview />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Router>
    </ThemeProvider>
  )
}

export default App
