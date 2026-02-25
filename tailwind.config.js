/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        slate: {
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
          400: '#94a3b8',
          100: '#f1f5f9',
        },
        indigo: {
          500: '#6366f1',
          600: '#4f46e5',
        },
        green: {
          500: '#22c55e',
        },
        amber: {
          500: '#f59e0b',
        },
        red: {
          500: '#ef4444',
        },
      },
    },
  },
  plugins: [],
}
