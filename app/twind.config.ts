import { Options } from "$fresh/plugins/twind.ts";

export default {
  selfURL: import.meta.url,
  theme: {
    extend: {
      colors: {
        "stremio-red": "#e50914",
        "stremio-gray": {
          "700": "#333",
          "800": "#1f2937",
          "900": "#141414",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
} as Options;
