import { useTheme } from "../../theme";

type ThemePickerProps = {
  title?: string;
  description?: string;
};

export default function ThemePicker({
  title = "Theme",
  description = "Choose how the app looks across the landing pages and interview studio.",
}: ThemePickerProps) {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div>
      <div className="mb-4">
        <h3 className="theme-text-primary text-base font-semibold">{title}</h3>
        <p className="theme-text-muted mt-1 text-sm">{description}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {themes.map((option) => {
          const isActive = option.id === theme;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setTheme(option.id)}
              className={`theme-choice rounded-2xl p-4 text-left ${isActive ? "theme-choice-active" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="theme-text-primary text-sm font-semibold">{option.name}</p>
                  <p className="theme-text-muted mt-1 text-xs">{option.description}</p>
                </div>
                <span className={`theme-chip rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${isActive ? "" : "opacity-0"}`}>
                  Active
                </span>
              </div>

              <div className="mt-4 flex gap-2">
                {option.swatches.map((color) => (
                  <span
                    key={`${option.id}-${color}`}
                    className="h-8 flex-1 rounded-xl border border-white/10"
                    style={{ background: color }}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
