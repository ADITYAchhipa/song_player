/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        music: {
          50: '#f0f3ff',
          100: '#e4ebff',
          200: '#cdddff',
          300: '#abbdff',
          400: '#8495ff',
          500: '#5c63ff', // Premium accent purple/blue
          600: '#4742f5',
          700: '#3830d9',
          800: '#2e26b3',
          900: '#1d1773'
        },
        darkBg: '#09090b', // Sleek dark slate
        darkCard: 'rgba(20, 20, 25, 0.7)' // Glassmorphic card overlay
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
        'float': 'float 4s ease-in-out infinite'
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        }
      }
    },
  },
  plugins: [],
}
