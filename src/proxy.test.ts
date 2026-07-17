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
    const brokenRegex = '/((?!api|_next|_vercel|.*\..*).*)';
    expect(matchers).not.toContain(brokenRegex);
  });
});

/**
 * clerkMiddleware handler must await auth.protect(). Without the await the
 * middleware returns before protection is enforced, leaking protected routes
 * to unauthenticated users. These tests exercise the handler directly.
 */
describe('proxy.ts handler', () => {
  // The mock makes clerkMiddleware return the raw handler, so `default` is
  // the (auth, req) function itself. Cast to a loose signature for testing.
  type Handler = (auth: { protect: () => Promise<unknown> }, req: unknown) => Promise<unknown>;

  it('awaits auth.protect() — rejects when protect rejects', async () => {
    const { default: handler } = await import('./proxy');
    const run = handler as unknown as Handler;

    const protect = vi.fn().mockRejectedValue(new Error('protected'));
    const auth = { protect };

    // createRouteMatcher is mocked to return false → route is non-public →
    // protect() is invoked. If it's properly awaited, the handler rejects.
    await expect(run(auth, {})).rejects.toThrow('protected');
    expect(protect).toHaveBeenCalledOnce();
  });

  it('returns intlMiddleware result when protect resolves', async () => {
    const { default: handler } = await import('./proxy');
    const run = handler as unknown as Handler;

    const protect = vi.fn().mockResolvedValue(undefined);
    const auth = { protect };

    // protect resolves, so the handler should resolve to intlMiddleware's
    // return value (mocked to null).
    const result = await run(auth, {});
    expect(result).toBeNull();
  });
});
