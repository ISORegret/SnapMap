/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
        700: '#171c23',
        800: '#12161c',
        900: '#080a0d',
        },
        accent: {
          DEFAULT: '#f6b73c',
          400: '#ffc85f',
          500: '#f6b73c',
          600: '#d99517',
          light: '#ffc85f',
          glow: '#f6b73c',
          dark: '#bd7a05',
          muted: 'rgba(246, 183, 60, 0.14)',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        'card': '18px',
        'card-lg': '24px',
      },
      boxShadow: {
        'glow': '0 16px 42px -12px rgba(246, 183, 60, 0.48)',
        'glow-sm': '0 10px 28px -10px rgba(246, 183, 60, 0.34)',
      },
      transitionDuration: {
        'smooth': '220ms',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'splash-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.9', transform: 'scale(1.02)' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'splash-progress': {
          '0%': { transform: 'translateX(-100%)' },
          '50%': { transform: 'translateX(200%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out forwards',
        'fade-in-up': 'fade-in-up 0.35s ease-out forwards',
        'splash-pulse': 'splash-pulse 2s ease-in-out infinite',
        'spin-slow': 'spin-slow 1s linear infinite',
        'splash-progress': 'splash-progress 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
