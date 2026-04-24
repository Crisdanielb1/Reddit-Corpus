import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#18181b",
        ink2: "#27272a",
        page: "#fafafa",
        surface: "#ffffff",
        line: "#e8e8ec",
        line2: "#f1f1f4",
        muted: "#71717a",
        soft: "#a1a1aa",
        accent: {
          DEFAULT: "#ff5a1f",
          hover: "#ff7a44",
          tint: "#fff1ea",
          deep: "#d94a14",
        },
        success: "#16a34a",
        danger: "#dc2626",
        warn: "#d97706",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "Consolas", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(255, 255, 255, 1) inset, 0 1px 2px rgba(24, 24, 27, 0.04), 0 8px 24px -12px rgba(24, 24, 27, 0.10)",
        soft: "0 1px 2px rgba(24, 24, 27, 0.05), 0 6px 16px -8px rgba(24, 24, 27, 0.08)",
        accent: "0 1px 0 rgba(255, 255, 255, 0.25) inset, 0 6px 16px -6px rgba(255, 90, 31, 0.45)",
        pop: "0 4px 8px -2px rgba(24,24,27,0.06), 0 16px 40px -12px rgba(24,24,27,0.18)",
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(0.85)" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        popIn: {
          from: { opacity: "0", transform: "translateY(-6px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        pulseDot: "pulseDot 1.4s ease-in-out infinite",
        fadeIn: "fadeIn 0.25s ease-out both",
        popIn: "popIn 0.16s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
