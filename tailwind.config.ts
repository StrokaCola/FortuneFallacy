import type { Config } from 'tailwindcss';

export default {
  content: ['./next.html', './src-next/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        cosmos: {
          50:  '#f3f0ff',
          100: '#dcd4ff',
          200: '#bba8ff',
          300: '#9577ff',
          400: '#7752f0',
          500: '#5c39c4',
          600: '#432896',
          700: '#2e1d6b',
          800: '#1c1245',
          900: '#0f0925',
        },
        ember:   '#ff7847',
        crimson: '#e2334a',
        gold:    '#f5c451',
        astral:  '#7be3ff',
      },
      fontFamily: {
        display: ['"Cinzel Decorative"', 'serif'],
        head:    ['Cinzel', 'serif'],
        body:    ['"Exo 2"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
