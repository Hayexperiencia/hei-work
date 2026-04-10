"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = (typeof localStorage !== "undefined"
      ? localStorage.getItem("hei-theme")
      : null) as Theme | null;
    const initial: Theme = stored ?? "dark";
    apply(initial);
    setTheme(initial);
  }, []);

  function apply(t: Theme) {
    const html = document.documentElement;
    if (t === "light") {
      html.classList.add("light");
      html.classList.remove("dark");
    } else {
      html.classList.add("dark");
      html.classList.remove("light");
    }
  }

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    apply(next);
    localStorage.setItem("hei-theme", next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]"
      title={`Cambiar a tema ${theme === "dark" ? "claro" : "oscuro"}`}
    >
      <span aria-hidden>{theme === "dark" ? "☀️" : "🌙"}</span>
      <span>{theme === "dark" ? "Claro" : "Oscuro"}</span>
    </button>
  );
}
