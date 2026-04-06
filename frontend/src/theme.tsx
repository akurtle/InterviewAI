import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export type ThemeName = "graphite" | "ocean" | "sunrise";

export type ThemeOption = {
  id: ThemeName;
  name: string;
  description: string;
  swatches: [string, string, string];
};

const STORAGE_KEY = "site_theme";

export const themeOptions: ThemeOption[] = [
  {
    id: "graphite",
    name: "Graphite",
    description: "Emerald accents over a deep studio-black interface.",
    swatches: ["#07111f", "#10b981", "#14b8a6"],
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Cool blue lighting for a cleaner, sharper presentation.",
    swatches: ["#071421", "#0ea5e9", "#2563eb"],
  },
  {
    id: "sunrise",
    name: "Sunrise",
    description: "Warm orange-red tones with a darker editorial backdrop.",
    swatches: ["#180c18", "#f97316", "#ef4444"],
  },
];

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  themes: ThemeOption[];
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const isThemeName = (value: string | null): value is ThemeName =>
  value === "graphite" || value === "ocean" || value === "sunrise";

const readInitialTheme = (): ThemeName => {
  if (typeof window === "undefined") {
    return "graphite";
  }

  const storedTheme = window.localStorage.getItem(STORAGE_KEY);
  return isThemeName(storedTheme) ? storedTheme : "graphite";
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(readInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: themeOptions }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}
