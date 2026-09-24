/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      // `slate` is the neutral every screen was written in. It was a cold
      // blue-grey — the dashboard default. Remapping it to a warm graphite
      // moves the whole game onto the keycap colourway (cream legends on
      // charcoal) without touching a thousand class names.
      colors: {
        slate: {
          50: '#f8f5ef',
          100: '#f1ebdf',
          200: '#e4dccb',
          300: '#c9c0b0',
          400: '#a09a90',
          500: '#78736d',
          600: '#57534f',
          700: '#3d3a38',
          800: '#28262a',
          900: '#1a191c',
          950: '#0e0d10'
        },
        signal: {
          DEFAULT: '#ff6a2b',
          hi: '#ff8f5c',
          deep: '#b8410f'
        },
        legend: '#efe7d6'
      },
      fontFamily: {
        mono: ['"Martian Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        display: ['Unbounded', '"Martian Mono"', 'system-ui', 'sans-serif'],
        prose: ['"Victor Mono"', '"Martian Mono"', 'ui-monospace', 'monospace']
      }
    }
  },
  plugins: []
};
