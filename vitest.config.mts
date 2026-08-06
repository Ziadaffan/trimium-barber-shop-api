import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
    clearMocks: true,
    // Loading the express app pulls in Prisma and winston, which is slow on a cold transform.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
