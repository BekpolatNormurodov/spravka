import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/shared/src/ui/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff', 100: '#dbe6ff', 200: '#bfd2ff', 300: '#93b4ff',
          400: '#608cff', 500: '#3b66f5', 600: '#2447e0', 700: '#1d37c2',
          800: '#1e319d', 900: '#1e2f7c',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
