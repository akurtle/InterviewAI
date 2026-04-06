import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../auth";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, loading, isConfigured } = useAuth();

  if (loading) {
    return (
      <div className="theme-page-shell flex min-h-screen items-center justify-center px-6">
        <div className="theme-panel rounded-2xl px-6 py-5 text-center">
          <p className="theme-text-primary font-semibold">Loading account</p>
          <p className="theme-text-muted mt-2 text-sm">Checking your auth session.</p>
        </div>
      </div>
    );
  }

  if (!isConfigured || !user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
