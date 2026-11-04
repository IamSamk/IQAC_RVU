import typography from "@tailwindcss/typography";
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm paper canvas and an ink scale for text and chrome
        canvas: "#F6F4EF",
        ink: {
          950: "#0E0C1D",
          900: "#17142B",
          800: "#221E3B",
          700: "#3A3554",
          500: "#6A6585",
          400: "#8E8AA6",
          300: "#BDB9CF",
          200: "#DCD9E6",
          100: "#ECEAF2",
          50: "#F7F6FA",
        },
        brand: {
          950: "#1C1450",
          900: "#271B73",
          800: "#33239A",
          700: "#4430C4",
          600: "#5640E0",
          500: "#7260F0",
          200: "#CFC7FF",
          100: "#E7E3FF",
          50: "#F3F1FF",
        },
        gold: {
          700: "#A15C07",
          600: "#C27510",
          500: "#F2A922",
          100: "#FDF0D5",
          50: "#FFF9EC",
        },
        success: {
          700: "#0B7A55",
          600: "#0E9466",
          500: "#16B07A",
          100: "#D6F5E8",
        },
        critical: {
          700: "#B42318",
          600: "#D92D20",
          100: "#FEE4E2",
        },
        teal: {
          700: "#0F766E",
          600: "#0D9488",
          100: "#D5F5F0",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(14,12,29,.04), 0 1px 1px rgba(14,12,29,.03)",
        lift: "0 10px 30px -12px rgba(28,20,80,.25)",
        glow: "0 0 0 4px rgba(86,64,224,.12)",
      },
      borderRadius: {
        "2xl": "1.1rem",
        "3xl": "1.5rem",
      },
      keyframes: {
        "halo-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 2px rgba(217,45,32,.75), 0 0 0 6px rgba(217,45,32,.25)" },
          "50%": { boxShadow: "0 0 0 2px rgba(217,45,32,.95), 0 0 0 12px rgba(217,45,32,.08)" },
        },
        "bridge-glow": {
          "0%, 100%": { boxShadow: "0 0 10px 2px rgba(242,169,34,.5)" },
          "50%": { boxShadow: "0 0 22px 6px rgba(242,169,34,.7)" },
        },
        wave: {
          "0%, 100%": { transform: "scaleY(.25)" },
          "50%": { transform: "scaleY(1)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "live-dot": {
          "0%": { boxShadow: "0 0 0 0 rgba(217,45,32,.55)" },
          "70%": { boxShadow: "0 0 0 8px rgba(217,45,32,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(217,45,32,0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        "halo-pulse": "halo-pulse 1.8s ease-in-out infinite",
        "bridge-glow": "bridge-glow 2.4s ease-in-out infinite",
        wave: "wave 1.1s ease-in-out infinite",
        "fade-up": "fade-up .35s ease-out both",
        "live-dot": "live-dot 1.6s ease-out infinite",
        shimmer: "shimmer 1.4s linear infinite",
      },
    },
  },
  plugins: [typography],
};

export default config;
