import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(99, 102, 241, 0.5)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },      // 'fade-in' uses `backwards`, not `both`: AppShell wraps every page in it, and `both`
      // holds the keyframe's transform forever after the animation ends. A lingering transform
      // makes that wrapper the containing block for `position: fixed`, so modals centred on the
      // content column instead of the screen and the dim stopped at the sidebar. `backwards`
      // still prevents the pre-animation flash, then reverts to transform: none.

      animation: {
        "fade-in": "fade-in 0.4s ease-out backwards",
      },
    },
  },
  plugins: [],
};

export default config;
