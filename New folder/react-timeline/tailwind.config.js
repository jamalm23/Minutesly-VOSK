/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // Scan JS/JSX files in src
    "../ui/pages/timeline/timeline.html" // Include timeline.html
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} 