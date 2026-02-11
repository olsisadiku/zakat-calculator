/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        parchment: {
          50: "#fefcf8",
          100: "#faf7f0",
          200: "#f0ebe0",
          300: "#e4dac8",
          400: "#d4c5a9",
          500: "#c4b08a",
        },
        forest: {
          DEFAULT: "#13291d",
          50: "#e9f5ee",
          100: "#c8e6d0",
          200: "#95c9a5",
          300: "#5faa78",
          400: "#3d8a58",
          500: "#2d6a4f",
          600: "#1e4d38",
          700: "#1a3d2b",
          800: "#13291d",
          900: "#0a1a10",
        },
        gold: {
          DEFAULT: "#b8860b",
          50: "#fdf8ed",
          100: "#f5e6c8",
          200: "#ebd09e",
          300: "#d4a843",
          400: "#c9981e",
          500: "#b8860b",
          600: "#9a7009",
          700: "#7c5a07",
          800: "#5e4405",
        },
        ink: {
          DEFAULT: "#1e1e1e",
          light: "#3d3d3d",
          lighter: "#6b6b6b",
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', "Georgia", "serif"],
        body: ['"Crimson Pro"', "Georgia", "serif"],
        ui: ['"DM Sans"', "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-xl": ["4.5rem", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        "display-lg": ["3.5rem", { lineHeight: "1.1", letterSpacing: "-0.015em" }],
        "display-md": ["2.5rem", { lineHeight: "1.15", letterSpacing: "-0.01em" }],
        "display-sm": ["1.875rem", { lineHeight: "1.2" }],
      },
      backgroundImage: {
        "geometric-pattern": `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cg fill='none' stroke='%23b8860b' stroke-width='0.5' opacity='0.12'%3E%3Crect x='20' y='20' width='40' height='40' transform='rotate(0 40 40)'/%3E%3Crect x='20' y='20' width='40' height='40' transform='rotate(45 40 40)'/%3E%3Ccircle cx='40' cy='40' r='14'/%3E%3Cline x1='40' y1='0' x2='40' y2='80'/%3E%3Cline x1='0' y1='40' x2='80' y2='40'/%3E%3Cline x1='0' y1='0' x2='80' y2='80'/%3E%3Cline x1='80' y1='0' x2='0' y2='80'/%3E%3C/g%3E%3C/svg%3E")`,
        "geometric-dark": `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cg fill='none' stroke='%23d4a843' stroke-width='0.5' opacity='0.08'%3E%3Crect x='20' y='20' width='40' height='40' transform='rotate(0 40 40)'/%3E%3Crect x='20' y='20' width='40' height='40' transform='rotate(45 40 40)'/%3E%3Ccircle cx='40' cy='40' r='14'/%3E%3Cline x1='40' y1='0' x2='40' y2='80'/%3E%3Cline x1='0' y1='40' x2='80' y2='40'/%3E%3Cline x1='0' y1='0' x2='80' y2='80'/%3E%3Cline x1='80' y1='0' x2='0' y2='80'/%3E%3C/g%3E%3C/svg%3E")`,
      },
      animation: {
        "fade-up": "fadeUp 0.8s ease-out forwards",
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "slide-in": "slideIn 0.6s ease-out forwards",
        "gold-shimmer": "goldShimmer 3s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(-16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        goldShimmer: {
          "0%, 100%": { opacity: "0.7" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
