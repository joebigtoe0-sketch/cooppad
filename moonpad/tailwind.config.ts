import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-coop-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      colors: {
        coop: {
          /** Light theme: page + panels (cream / shell family) */
          canvas: "#FAF6EA",
          surface: "#FFFCF5",
          "surface-warm": "#FDF0D5",
          /** Legacy dark scale — wallet modal, rare contrast blocks */
          950: "#0a0818",
          900: "#151222",
          800: "#1e1a2c",
          700: "#2d2740",
          ink: "#633806",
          yolk: "#E8A020",
          "yolk-soft": "#FDF0D5",
          orange: "#D85A30",
          "orange-soft": "#FAECE7",
          sky: "#534AB7",
          "sky-soft": "#EEEDFE",
          straw: "#D4B896",
          wood: "#8B5E3C",
          grass: "#3B6D11",
          "grass-soft": "#EAF3DE",
          shell: "#F5ECD7",
        },
      },
    },
  },
  plugins: [],
};

export default config;
