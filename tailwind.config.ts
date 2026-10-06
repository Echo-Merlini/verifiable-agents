import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-space-grotesk)", "Space Grotesk", "sans-serif"],
        serif:   ["var(--font-newsreader)", "Newsreader", "Georgia", "serif"],
        mono:    ["var(--font-jetbrains)", "JetBrains Mono", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
        tighter2: "-0.03em",
      },
      // Every colour resolves through a CSS variable so a theme switch is one
      // attribute on <html>, not a `dark:` variant on 2,490 call sites.
      //
      // The channels are space-separated RGB on purpose. 606 usages in src/ carry an
      // opacity modifier (text-paper/70, border-gb-border/40, …); with a plain
      // var(--x) holding a hex, Tailwind cannot compose <alpha-value> and every one
      // of those silently loses its transparency. rgb(... / <alpha-value>) keeps them.
      colors: {
        // Elevation, not colour. On a dark ground you lift a surface with white at a
        // low alpha and draw a hairline the same way; on a light ground the identical
        // role wants ink. Keeping the ALPHA and swapping only the channel means the
        // compositing is unchanged — bg-elevate/5 in dark is byte-for-byte bg-white/5,
        // because --c-elevate is 255 255 255 there. Replacing these with solid colours
        // instead would shift every nested panel, since the blend depends on what is behind.
        elevate:    "rgb(var(--c-elevate) / <alpha-value>)",
        hairline:   "rgb(var(--c-hairline) / <alpha-value>)",

        // Vértice brand palette
        ink:        "rgb(var(--c-ink) / <alpha-value>)",
        deepink:    "rgb(var(--c-deepink) / <alpha-value>)",
        slate:      "rgb(var(--c-slate) / <alpha-value>)",
        brass:      "rgb(var(--c-brass) / <alpha-value>)",
        brassLight: "rgb(var(--c-brassLight) / <alpha-value>)",
        paper:      "rgb(var(--c-paper) / <alpha-value>)",
        face: {
          1: "rgb(var(--c-face-1) / <alpha-value>)",
          2: "rgb(var(--c-face-2) / <alpha-value>)",
          3: "rgb(var(--c-face-3) / <alpha-value>)",
          4: "rgb(var(--c-face-4) / <alpha-value>)",
        },
        // Boiler Kit tokens remapped to Vértice — keeps every *-gb-* class working
        gb: {
          bg:      "rgb(var(--c-gb-bg) / <alpha-value>)",
          surface: "rgb(var(--c-gb-surface) / <alpha-value>)",
          border:  "rgb(var(--c-gb-border) / <alpha-value>)",
          borderL: "rgb(var(--c-gb-borderL) / <alpha-value>)",
          input:   "rgb(var(--c-gb-input) / <alpha-value>)",
          muted:   "rgb(var(--c-gb-muted) / <alpha-value>)",
          faint:   "rgb(var(--c-gb-faint) / <alpha-value>)",
          accent:  "rgb(var(--c-gb-accent) / <alpha-value>)",
          accentD: "rgb(var(--c-gb-accentD) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
