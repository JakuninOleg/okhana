import { describe, it, expect, vi } from 'vitest';

// Mock dependencies before importing proxy.ts — next-intl/middleware and
// @clerk/nextjs/server both pull in next/server which doesn't resolve
// correctly in the vitest Node environment.
vi.mock('next-intl/middleware', () => ({
  default: () => () => null,
}));

vi.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: (handler: unknown) => handler,
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
    const brokenRegex = '/((?!api|_next|_vercel|.*\..*).*)';
    expect(matchers).not.toContain(brokenRegex);
  });
});

/**
 * Following Clerk's guidance after CVE-2026-41248, proxy.ts no longer gates
 * routes via createRouteMatcher()/auth.protect() — middleware-only
 * protection can be bypassed by requests that never reach the matcher.
 * clerkMiddleware() is retained solely to make auth() context available in
 * Server Components; the handler must simply delegate to intlMiddleware
 * without performing any auth checks itself. Route protection now lives in
 * each protected page (see src/app/[locale]/dashboard/page.tsx).
 */
describe('proxy.ts handler', () => {
  type Handler = (auth: unknown, req: unknown) => unknown;

  it('does not perform auth checks — delegates directly to intlMiddleware', async () => {
    const { default: handler } = await import('./proxy');
    const run = handler as unknown as Handler;

    // No auth.protect() call is made; passing a bare object (no `protect`
    // method) proves the handler never invokes it.
    const result = run({}, {});
    expect(result).toBeNull();
  });
});
