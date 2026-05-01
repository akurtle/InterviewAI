import Footer from "../components/Layout/Footer";
import Navbar from "../components/Layout/Navbar";
import AccountHeader from "../components/Account/AccountHeader";
import AccountSessionDetails from "../components/Account/AccountSessionDetails";
import AccountSessionList from "../components/Account/AccountSessionList";
import { useAccountPage } from "../hooks/useAccountPage";

export default function Account() {
  const account = useAccountPage();

  return (
    <div className="theme-page-shell">
      <Navbar />

      <section className="relative overflow-hidden px-6 pb-20 pt-32">
        <div className="theme-grid-overlay absolute inset-0 opacity-70" />
        <div className="absolute inset-0 opacity-35">
          <div className="theme-glow-primary absolute left-[10%] top-[16%] h-72 w-72 rounded-full blur-3xl" />
          <div className="theme-glow-secondary absolute bottom-[10%] right-[10%] h-72 w-72 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl">
          <AccountHeader
            isConfigured={account.isConfigured}
            userEmail={account.user?.email}
            onSignOut={account.signOut}
          />

          {account.status === "loading" && (
            <div className="theme-panel rounded-2xl p-6">
              <p className="theme-text-primary font-semibold">Loading sessions</p>
              <p className="theme-text-muted mt-2 text-sm">
                Fetching your saved interview history from Supabase.
              </p>
            </div>
          )}

          {account.status === "error" && account.error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm text-red-100">{account.error}</p>
            </div>
          )}

          {account.status === "ready" && account.sessions.length === 0 && (
            <div className="theme-panel rounded-2xl p-8">
              <p className="theme-text-primary text-lg font-semibold">No saved sessions yet</p>
              <p className="theme-text-muted mt-2 text-sm">
                Finish a mock interview or pitch session while signed in and it will appear here
                automatically.
              </p>
            </div>
          )}

          {account.sessions.length > 0 && (
            <div className="grid gap-6 xl:grid-cols-[360px,minmax(0,1fr)]">
              <AccountSessionList
                selectedSessionId={account.selectedSessionId}
                sessions={account.sessions}
                onSelect={account.handleSessionSelect}
              />
              <AccountSessionDetails
                detailStatus={account.detailStatus}
                error={account.error}
                recordingError={account.recordingError}
                recordingStatus={account.recordingStatus}
                recordingUrl={account.recordingUrl}
                selectedSession={account.selectedSession}
                selectedSessionAnswers={account.selectedSessionAnswers}
              />
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
