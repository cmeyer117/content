/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#ffffff',
        card: '#f8fafc',
        border: '#e2e8f0',
        accent: '#3b82f6',
      },
    },
  },
  plugins: [],
}
