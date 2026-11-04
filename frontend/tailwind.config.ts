import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          950: "#2E1065",
          900: "#3B1A82",
          700: "#4338CA",
          600: "#4F46E5",
          100: "#E0E7FF",
          50: "#EEF2FF",
        },
        gold: {
          700: "#B45309",
          500: "#F59E0B",
          100: "#FEF3C7",
          50: "#FFFBEB",
        },
        success: {
          700: "#047857",
          500: "#10B981",
          100: "#D1FAE5",
        },
        critical: {
          700: "#B91C1C",
          600: "#DC2626",
          100: "#FEE2E2",
        },
        teal: {
          700: "#0F766E",
          600: "#0D9488",
          100: "#CCFBF1",
        },
      },
      fontFamily: {
        sans: ["Fira Sans", "system-ui", "sans-serif"],
        mono: ["Fira Code Variable", "ui-monospace", "monospace"],
      },
      keyframes: {
        "halo-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 2px rgba(220,38,38,.75), 0 0 0 6px rgba(220,38,38,.25)" },
          "50%": { boxShadow: "0 0 0 2px rgba(220,38,38,.95), 0 0 0 12px rgba(220,38,38,.08)" },
        },
        "bridge-glow": {
          "0%, 100%": { boxShadow: "0 0 10px 2px rgba(245,158,11,.5)" },
          "50%": { boxShadow: "0 0 22px 6px rgba(245,158,11,.7)" },
        },
        wave: {
          "0%, 100%": { transform: "scaleY(.25)" },
          "50%": { transform: "scaleY(1)" },
        },
      },
      animation: {
        "halo-pulse": "halo-pulse 1.8s ease-in-out infinite",
        "bridge-glow": "bridge-glow 2.4s ease-in-out infinite",
        wave: "wave 1.1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
