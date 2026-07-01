"use client";

import { useEffect, useState } from "react";

type AppTheme = "light" | "dark";

const THEME_STORAGE_KEY = "ai-dashboard-theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<AppTheme>("light");
  const isDark = theme === "dark";
  const label = isDark ? "Disable dark mode" : "Enable dark mode";

  useEffect(() => {
    setTheme(resolveCurrentTheme());

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      if (readStoredTheme()) {
        return;
      }

      const nextTheme = getSystemTheme();

      applyTheme(nextTheme, false);
      setTheme(nextTheme);
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () =>
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, []);

  function toggleTheme() {
    const nextTheme = isDark ? "light" : "dark";

    applyTheme(nextTheme, true);
    setTheme(nextTheme);
  }

  return (
    <button
      aria-label={label}
      aria-pressed={isDark}
      className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--color-control-border)] bg-[var(--color-control-bg)] px-2.5 text-xs font-semibold text-[var(--color-control-text)] shadow-sm transition hover:bg-[var(--color-control-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-app-focus-ring)]"
      onClick={toggleTheme}
      title={label}
      type="button"
    >
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 rounded-full border border-[var(--color-control-border)] transition-colors ${
          isDark
            ? "bg-[var(--color-tab-active-border)]"
            : "bg-[var(--color-control-hover-bg)]"
        }`}
      >
        <span
          className={`absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[var(--color-app-surface)] shadow-sm transition-transform ${
            isDark ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
      <span>{isDark ? "Dark" : "Light"}</span>
    </button>
  );
}

function resolveCurrentTheme(): AppTheme {
  return (
    readStoredTheme() ??
    readDocumentTheme() ??
    getSystemTheme()
  );
}

function readStoredTheme(): AppTheme | null {
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

  return isAppTheme(storedTheme) ? storedTheme : null;
}

function readDocumentTheme(): AppTheme | null {
  const documentTheme = document.documentElement.dataset.theme;

  return isAppTheme(documentTheme) ? documentTheme : null;
}

function getSystemTheme(): AppTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: AppTheme, persist: boolean): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  if (persist) {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
}

function isAppTheme(value: string | null | undefined): value is AppTheme {
  return value === "light" || value === "dark";
}
