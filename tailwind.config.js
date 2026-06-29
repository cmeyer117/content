/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#0f0f0f',
        card: '#1a1a1a',
        border: '#2a2a2a',
        accent: '#3b82f6',
      },
    },
  },
  plugins: [],
}
