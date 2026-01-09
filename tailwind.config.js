/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        orange: '#FF6B35',
        pink: '#FF006E',
        green: '#00D9A3',
        blue: '#4361EE',
      },
    },
  },
  plugins: [],
}
