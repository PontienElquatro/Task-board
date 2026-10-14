import { afterEach, vi } from 'vitest';

// Jasmine previously restored its spies automatically between tests.
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
