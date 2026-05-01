type Props = {
  isConfigured: boolean;
  userEmail?: string;
  onSignOut: () => void | Promise<void>;
};

const AccountHeader = ({ isConfigured, userEmail, onSignOut }: Props) => {
  return (
    <>
      <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="theme-accent-text text-sm uppercase tracking-[0.24em]">User Page</p>
          <h1 className="theme-text-primary mt-3 text-4xl font-bold md:text-5xl">
            Past session feedback
          </h1>
          <p className="theme-text-muted mt-3 max-w-2xl text-base">
            {userEmail
              ? `Signed in as ${userEmail}. Review prior interview and pitch sessions, including transcripts and feedback.`
              : "Sign in to review stored interview history."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void onSignOut();
          }}
          className="theme-button-secondary rounded-xl px-4 py-2 text-sm font-medium"
        >
          Sign out
        </button>
      </div>

      {!isConfigured && (
        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4">
          <p className="text-sm text-yellow-100">
            Supabase is not configured. Add the frontend env vars and run the schema in
            `supabase/schema.sql`.
          </p>
        </div>
      )}
    </>
  );
};

export default AccountHeader;
