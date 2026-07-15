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
      colors: {
        // Vértice brand palette
        ink:        "#17191F",
        deepink:    "#0C0D11",
        slate:      "#5C616D",
        brass:      "#A15E1E",
        brassLight: "#E0A24C",
        paper:      "#F6F6F8",
        face: { 1: "#3A3E48", 2: "#2C2F37", 3: "#22242B", 4: "#191B21" },
        // Boiler Kit tokens remapped to Vértice — keeps every *-gb-* class working
        gb: {
          bg:      "#0C0D11",   // deepink ground
          surface: "#191B21",   // matte panel
          border:  "#242832",   // hairline
          borderL: "#191B21",
          input:   "#191B21",
          muted:   "#5C616D",   // slate
          faint:   "#8A909C",
          accent:  "#E0A24C",   // brassLight
          accentD: "#A15E1E",   // brass
        },
      },
    },
  },
  plugins: [],
};

export default config;
