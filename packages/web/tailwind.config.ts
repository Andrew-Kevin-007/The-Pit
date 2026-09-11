import type { Config } from "tailwindcss";

// The Pit — dark arcade arena design system.
// See README.md "Design System" — do not add new one-off colors elsewhere;
// every page pulls from this same palette + type scale.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "pit-black": "#0a0a0a",
        "pit-surface": "#111114",
        "pit-border": "#1f1f24",
        "pit-green": "#00ff87",
        "pit-red": "#ff3c5f",
        "pit-yellow": "#ffd600",
        "pit-dim": "#4a4a55",
        "pit-white": "#e8e8f0",
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "pulse-yellow": { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.4" } },
        flash: { "0%": { opacity: "0" }, "20%": { opacity: "1" }, "100%": { opacity: "1" } },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "slide-up": "slide-up 200ms ease-out",
        "pulse-yellow": "pulse-yellow 1s ease-in-out infinite",
        flash: "flash 300ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
