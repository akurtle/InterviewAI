import { createContext, useContext } from "react";

export type ThemeName = "graphite" | "ocean" | "sunrise";

export type ThemeOption = {
  id: ThemeName;
  name: string;
  description: string;
  swatches: [string, string, string];
};

export type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  themes: ThemeOption[];
};

export const STORAGE_KEY = "site_theme";

export const themeOptions: ThemeOption[] = [
  {
    id: "graphite",
    name: "Graphite",
    description: "Emerald accents over a deep studio-black interface.",
    swatches: ["oklch(0.13 0.02 220)", "oklch(0.72 0.18 168)", "oklch(0.35 0.12 168)"],
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Cool blue lighting for a cleaner, sharper presentation.",
    swatches: ["oklch(0.13 0.025 235)", "oklch(0.72 0.18 220)", "oklch(0.35 0.12 220)"],
  },
  {
    id: "sunrise",
    name: "Sunrise",
    description: "Warm orange-red tones with a darker editorial backdrop.",
    swatches: ["oklch(0.13 0.025 35)", "oklch(0.72 0.18 45)", "oklch(0.72 0.18 15)"],
  },
];

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export const isThemeName = (value: string | null): value is ThemeName =>
  value === "graphite" || value === "ocean" || value === "sunrise";

export const readInitialTheme = (): ThemeName => {
  if (typeof window === "undefined") {
    return "graphite";
  }

  const storedTheme = window.localStorage.getItem(STORAGE_KEY);
  return isThemeName(storedTheme) ? storedTheme : "graphite";
};

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}
