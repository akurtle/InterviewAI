import GetStarted from './pages/GetStarted'
import Home from './pages/Home'
import { Route, BrowserRouter as Router,Routes } from 'react-router-dom'

function App() {

  return (
   <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/get-started" element={<GetStarted />} />
      </Routes>
    </Router>
  )
}

export default App
