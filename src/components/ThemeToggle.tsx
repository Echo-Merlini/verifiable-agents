"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

/**
 * Circular light/dark switch for the header.
 *
 * Reads the attribute ThemeApply already manages rather than keeping its own state,
 * so the two can never disagree. Renders nothing until mounted: the server does not
 * know the stored theme, so drawing an icon before that would mean rendering the wrong
 * one and swapping it on hydration.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [light, setLight] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setLight(localStorage.getItem("vx-theme") === "light");
    } catch { /* blocked storage: fall back to dark */ }
  }, []);

  const toggle = () => {
    const next = !light;
    setLight(next);
    try { localStorage.setItem("vx-theme", next ? "light" : "dark"); } catch { /* ignore */ }
    const el = document.documentElement;
    if (next) el.setAttribute("data-theme", "light");
    else el.removeAttribute("data-theme");
  };

  // Keep the button out of the tab order and off screen readers until it is real.
  if (!mounted) return <span className={`inline-block h-7 w-7 ${className}`} aria-hidden />;

  return (
    <button
      onClick={toggle}
      aria-label={light ? "Switch to dark" : "Switch to light"}
      title={light ? "Switch to dark" : "Switch to light"}
      className={`group inline-flex h-7 w-7 items-center justify-center rounded-full border border-gb-border
                  text-gb-faint transition-colors hover:border-brassLight/50 hover:text-brassLight ${className}`}
    >
      <span className="transition-transform duration-500 group-hover:rotate-180">
        {light ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}
