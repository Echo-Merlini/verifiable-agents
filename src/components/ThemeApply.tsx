"use client";

import { useEffect } from "react";

/**
 * Keeps data-theme on <html> after React has hydrated.
 *
 * The inline script in layout.tsx sets the attribute before paint, which avoids a flash.
 * That alone is not enough: <html> is rendered by the root layout, so React owns it and
 * reconciles its attributes against the server markup — which has no data-theme — and
 * removes it. suppressHydrationWarning does not prevent that; it only silences the warning.
 * The observed symptom was light flashing and snapping back to dark.
 *
 * So the attribute is re-applied here after every render. Deliberately no dependency array:
 * if a later render strips it again, the next commit puts it back.
 */
export function ThemeApply() {
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search).get("theme");
      if (p === "light" || p === "dark") localStorage.setItem("vx-theme", p);
      const t = localStorage.getItem("vx-theme");
      const el = document.documentElement;
      if (t === "light") el.setAttribute("data-theme", "light");
      else el.removeAttribute("data-theme");
    } catch {
      /* blocked storage must not take the page down */
    }
  });
  return null;
}
