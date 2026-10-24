/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f2f6fb',
          100: '#e3ecf7',
          200: '#c2d6ec',
          300: '#8fb4da',
          400: '#558cc3',
          500: '#316dab',
          600: '#22548c',
          700: '#1c4472',
          800: '#173a5f',
          900: '#0f2743',
          950: '#0a1a2e',
        },
        teal: {
          50: '#eefdfb',
          100: '#d2f8f4',
          200: '#a9f0ea',
          300: '#71e3dc',
          400: '#3ecdc7',
          500: '#19b1ad',
          600: '#118d8c',
          700: '#127071',
          800: '#14595a',
          900: '#154a4b',
          950: '#052c2e',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'Segoe UI',
          'system-ui',
          '-apple-system',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'Consolas', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 39 67 / 0.06), 0 1px 3px 0 rgb(15 39 67 / 0.10)',
        panel: '0 4px 24px -8px rgb(15 39 67 / 0.18)',
      },
    },
  },
  plugins: [],
};
