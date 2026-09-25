import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

// Load test env before any module reads process.env.
config({ path: '.env.test', override: true });

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/globalSetup.ts'],
    // One shared database → run files sequentially.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
