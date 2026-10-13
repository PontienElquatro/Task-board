import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Bound browser startup separately from test execution on slower machines.
    browser: { connectTimeout: 180_000, api: { host: '127.0.0.1' } },
    fileParallelism: false,
    maxWorkers: 1,
  },
});
