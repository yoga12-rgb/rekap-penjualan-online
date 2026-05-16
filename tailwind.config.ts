import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#b91c1c",
          foreground: "#ffffff"
        }
      }
    }
  },
  plugins: []
};
export default config;
