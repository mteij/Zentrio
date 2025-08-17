import { Options } from "$fresh/plugins/twind.ts";

export default {
  selfURL: import.meta.url,
  theme: {
    extend: {
      colors: {
        "zentrio-red": "#e50914",
        red: {
          600: "#e50914",
          700: "#b00610",
        },

        "zentrio-gray": {
          700: "#333",
          800: "#1f2937",
          900: "#141414",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
} as Options;
