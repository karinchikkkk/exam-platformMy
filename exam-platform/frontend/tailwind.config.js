/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ran: {
          red: '#c8102e', 
          dark: '#1e3a8a',
        }
      }
    },
  },
  plugins: [],
}