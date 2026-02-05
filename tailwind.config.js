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
          700: '#151a18',
          800: '#0f1412',
          900: '#080c0a',
        },
        accent: {
          DEFAULT: '#10b981',
          light: '#34d399',
          glow: '#34d399',
          dark: '#059669',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 24px -4px rgba(52, 211, 153, 0.25)',
        'glow-sm': '0 0 16px -4px rgba(52, 211, 153, 0.2)',
      },
    },
  },
  plugins: [],
};
