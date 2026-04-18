import { CALL_ENVIRONMENT_OPTIONS } from "./callEnvironments";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const MockInterviewInfoModal = ({ isOpen, onClose }: Props) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="theme-panel relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6 backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="theme-text-primary text-lg font-semibold">Session information</h2>
            <p className="theme-text-muted text-sm">
              Details moved here so the practice screen stays calmer.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="theme-button-secondary rounded-lg px-3 py-1.5 text-xs"
          >
            Close
          </button>
        </div>

        <div className="space-y-4">
          <div className="theme-panel-soft rounded-2xl p-4">
            <p className="theme-text-primary text-sm font-semibold">Room simulator</p>
            <p className="theme-text-muted mt-2 text-sm">
              The environment switch changes the stage UI only. Your recording, transcription,
              feedback, and backend behavior stay the same.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {CALL_ENVIRONMENT_OPTIONS.map((environment) => (
                <div key={environment.id} className="theme-panel rounded-xl px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="theme-text-primary text-sm font-semibold">{environment.label}</p>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] ${environment.accentClassName}`}
                    >
                      {environment.shortLabel}
                    </span>
                  </div>
                  <p className="theme-text-muted mt-2 text-xs leading-5">
                    {environment.helperText}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="theme-panel-soft rounded-2xl p-4">
            <p className="theme-text-primary text-sm font-semibold">What happens after a session</p>
            <p className="theme-text-muted mt-2 text-sm">
              Speech and video feedback are generated after you stop. If you are signed in, the
              completed session is also saved to your account.
            </p>
          </div>

          <div className="theme-panel-soft rounded-2xl p-4">
            <p className="theme-text-primary text-sm font-semibold">Live articulation</p>
            <p className="theme-text-muted mt-2 text-sm">
              Mouth tracking estimates visible articulation during video sessions. It helps with
              presence and clarity, but it does not score exact pronunciation.
            </p>
          </div>

          <div className="theme-panel-soft rounded-2xl p-4">
            <p className="theme-text-primary text-sm font-semibold">Quick practice tips</p>
            <ul className="theme-text-muted mt-2 space-y-2 text-sm">
              <li>Keep your face and shoulders visible.</li>
              <li>Pause briefly before key points.</li>
              <li>Use full examples instead of one-line answers.</li>
              <li>Choose audience view when you want public speaking pressure.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MockInterviewInfoModal;
