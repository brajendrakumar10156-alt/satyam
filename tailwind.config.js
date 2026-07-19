/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tvBackground: '#131722',
        tvPanel: '#1c2030',
        tvBorder: '#2a2e39',
        tvBlue: '#2962ff',
        tvGreen: '#26a69a',
        tvRed: '#ef5350'
      }
    },
  },
  plugins: [],
}