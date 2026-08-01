import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  // Relative production assets keep the same static build deployable at a
  // GitHub Pages subpath or at the root of another static host.
  base: mode === 'production' ? './' : '/',
  build: {
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
}));
