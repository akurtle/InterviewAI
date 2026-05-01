import { Suspense, lazy } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth";
import ProtectedRoute from "./components/Auth/ProtectedRoute";
import { ThemeProvider } from "./theme";

const Home = lazy(() => import("./pages/Home"));
const GetStarted = lazy(() => import("./pages/GetStarted"));
const InterviewType = lazy(() => import("./pages/InterviewType"));
const MockInterview = lazy(() => import("./pages/MockInterview"));
const Settings = lazy(() => import("./pages/Settings"));
const Auth = lazy(() => import("./pages/Auth"));
const Account = lazy(() => import("./pages/Account"));

function RouteFallback() {
  return (
    <div className="theme-page-shell flex min-h-screen items-center justify-center px-6">
      <div className="theme-panel rounded-2xl px-6 py-5 text-center">
        <p className="theme-text-primary font-semibold">Loading page</p>
        <p className="theme-text-muted mt-2 text-sm">Preparing the next screen.</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Suspense fallback={<RouteFallback />}>
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
          </Suspense>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
