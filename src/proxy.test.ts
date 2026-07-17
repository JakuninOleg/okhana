import { describe, it, expect, vi } from 'vitest';

// Mock dependencies before importing proxy.ts — next-intl/middleware and
// @clerk/nextjs/server both pull in next/server which doesn't resolve
// correctly in the vitest Node environment.
vi.mock('next-intl/middleware', () => ({
  default: () => () => null,
}));

vi.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: (handler: unknown) => handler,
  createRouteMatcher: () => () => false,
}));

vi.mock('./i18n/routing', () => ({
  routing: { locales: ['ru', 'en'], defaultLocale: 'ru' },
}));

/**
 * The proxy matcher is critical for Clerk auth to work.
 * The common regex '/((?!api|_next|_vercel|.*\..*).*)' silently fails
 * in Next.js 16 + Turbopack for dynamic locale routes like /ru, /en.
 * These tests guard against regressing to the broken regex matcher.
 */
describe('proxy.ts config', () => {
  it('matcher includes root route', async () => {
    const { config } = await import('./proxy');
    expect(config.matcher).toContain('/');
  });

  it('matcher includes locale routes with path segments', async () => {
    const { config } = await import('./proxy');
    expect(config.matcher).toContain('/(ru|en)/:path*');
  });

  it('matcher includes bare locale routes', async () => {
    const { config } = await import('./proxy');
    expect(config.matcher).toContain('/(ru|en)');
  });

  it('matcher does not use the broken regex pattern', async () => {
    const { config } = await import('./proxy');
    const matchers = config.matcher as string[];
    // This regex silently fails to match /ru and /en in Turbopack
    const brokenRegex = '/((?!api|_next|_vercel|.*\\..*).*)';
    expect(matchers).not.toContain(brokenRegex);
  });
});
