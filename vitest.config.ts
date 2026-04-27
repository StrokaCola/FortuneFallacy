import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src-next/**/*.test.ts', 'src-next/**/*.test.tsx'],
    exclude: ['node_modules/**', 'dist/**'],
  },
  resolve: {
    alias: {
      '@next': path.resolve(process.cwd(), 'src-next'),
    },
  },
});
