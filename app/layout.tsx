import type { Metadata } from "next";
import "./globals.css";

const THEME_INIT_SCRIPT = `
(() => {
  try {
    const storageKey = "ai-dashboard-theme";
    const storedTheme = window.localStorage.getItem(storageKey);
    const theme =
      storedTheme === "dark" || storedTheme === "light"
        ? storedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";

    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch {
  }
})();
`;

export const metadata: Metadata = {
  title: "AI Agents Frontend",
  description: "A fresh Next.js front-end project.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
          suppressHydrationWarning
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
