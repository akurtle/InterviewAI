import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  STORAGE_KEY,
  ThemeContext,
  readInitialTheme,
  themeOptions,
} from "./themeCore";
import type { ThemeName } from "./themeCore";

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
