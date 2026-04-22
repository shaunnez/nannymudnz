import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@nannymud/shared': path.resolve(__dirname, 'packages/shared/src'),
    },
  },
  test: {
    include: [
      'src/**/*.test.ts',
      'packages/shared/src/**/*.test.ts',
      'packages/server/src/**/*.test.ts',
    ],
    environment: 'node',
  },
});
