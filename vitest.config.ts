import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts', 'packages/*/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**'],
      exclude: ['packages/*/src/**/*.test.ts', '**/dist/**'],
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
    },
  },
});
