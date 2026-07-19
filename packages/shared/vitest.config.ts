import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Node for the pure logic; jsdom for anything that has to be typed into. The editable document
    // is why the second one exists — its whole job is to receive keystrokes, and a static render
    // says nothing about whether they arrive.
    environmentMatchGlobs: [
      ['src/**/*.test.tsx', 'happy-dom'],
      ['**', 'node'],
    ],
  },
});
