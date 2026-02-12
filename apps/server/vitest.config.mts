
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@laburauto/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/types/**/*.ts', 'src/db/migrations/**/*.ts', 'tests/**/*'],
    },
  },
  resolve: {
    extensions: ['.ts', '.js', '.json', '.node']
  }
});
