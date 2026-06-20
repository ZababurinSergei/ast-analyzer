// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true, // <-- Добавить эту строку
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/__tests__/fixtures/**', '**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules',
        'dist',
        'src/__tests__/fixtures',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'vitest.config.ts',
        'vitest.setup.ts',
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
