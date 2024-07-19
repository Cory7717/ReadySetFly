/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}, "],
  theme: {
    extend: {
      colors: {
        primary: "#f5fffa",
        secondary: {
          DEFAULT: "#00CCBB",
          100: "#00CCBB",
          200: "#00CCBB",
        },
        black: {
          DEFAULT: "#000",
          100: "#1E1E2D",
          200: "#232533",
        },
        gray: {
          100: "#CDCDE0",
        },
      },
      fontFamily: {
        pthin: ["Poppins-Thin", "sans-serif"],
        pextralight: ["Poppins-ExtraLight", "sans-serif"],
        plight: ["Poppins-Light", "sans-serif"],
        pregular: ["Poppins-Regular", "sans-serif"],
        pmedium: ["Poppins-Medium", "sans-serif"],
        psemibold: ["Poppins-SemiBold", "sans-serif"],
        pbold: ["Poppins-Bold", "sans-serif"],
        pextrabold: ["Poppins-ExtraBold", "sans-serif"],
        pblack: ["Poppins-Black", "sans-serif"],
        rubikblack: ["Rubik-Black", "sans-serif"],
        rubikbold: ["Rubik-Bold", "sans-serif"],
        rubikregular: ["Rubik-Regular", "sans-serif"],
        rubikextrabold: ["Rubik-ExtraBold", "sans-serif"],
      },
    },
  },
  plugins: [],
};