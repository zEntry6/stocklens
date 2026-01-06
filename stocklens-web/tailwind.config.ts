import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // StockLens Dark Trader Theme
        background: "#131722",
        card: "#1e222d",
        "card-hover": "#262b38",
        border: "#2a2e39",
        
        // Text colors
        "text-primary": "#d1d4dc",
        "text-secondary": "#787b86",
        "text-muted": "#4a4e59",
        
        // Trading colors
        buy: "#22c55e",
        "buy-bg": "rgba(34, 197, 94, 0.1)",
        sell: "#ef4444",
        "sell-bg": "rgba(239, 68, 68, 0.1)",
        
        // Accent
        accent: "#2962ff",
        "accent-hover": "#1e4bd8",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
