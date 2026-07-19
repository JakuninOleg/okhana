import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const testMock = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@': testMock('./src'),
      '@clerk/nextjs/server': testMock('./src/test/mocks/clerk-nextjs-server.ts'),
      'next/cache': testMock('./src/test/mocks/next-cache.ts'),
      'next/headers': testMock('./src/test/mocks/next-headers.ts'),
      'next/server': testMock('./src/test/mocks/next-server.ts'),
      'next/navigation': testMock('./src/test/mocks/next-navigation.ts'),
      'next-intl/middleware': testMock('./src/test/mocks/next-intl-middleware.ts'),
      'next-intl/server': testMock('./src/test/mocks/next-intl-server.ts'),
      'svix': testMock('./src/test/mocks/svix.ts'),
    },
  },
  test: {
    environment: 'node',
    pool: 'vmThreads',
  },
});
