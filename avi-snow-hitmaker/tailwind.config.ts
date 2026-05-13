import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0a",
        card: "#161616",
        line: "#262626",
        body: "#e5e5e5",
        muted: "#737373",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      backgroundImage: {
        sunset: "linear-gradient(90deg, #fb923c, #f59e0b, #f43f5e)",
      },
      boxShadow: {
        warm: "0 10px 40px -10px rgba(251, 146, 60, 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
