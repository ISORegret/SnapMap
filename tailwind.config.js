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
          700: '#1a191f',
          800: '#15141a',
          900: '#0f0e12',
        },
        accent: {
          DEFAULT: '#e8a735',
          400: '#f0b84d',
          500: '#e8a735',
          600: '#c4932a',
          light: '#f0b84d',
          glow: '#e8a735',
          dark: '#c4932a',
          muted: 'rgba(232, 167, 53, 0.2)',
        },
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        'card': '14px',
        'card-lg': '18px',
      },
      boxShadow: {
        'glow': '0 0 24px -4px rgba(232, 167, 53, 0.25)',
        'glow-sm': '0 0 16px -4px rgba(232, 167, 53, 0.2)',
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
