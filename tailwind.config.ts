import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefdf3",
          100: "#d6f9e1",
          500: "#16a34a",
          600: "#15803d",
          700: "#166534",
        },
        warn: "#f59e0b",
        danger: "#dc2626",
        info: "#2563eb",
      },
    },
  },
  plugins: [],
};
export default config;
