import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

const isPublicRoute = createRouteMatcher([
  '/',
  '/:locale',
  '/:locale/sign-in(.*)',
  '/:locale/sign-up(.*)',
]);

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) {
    auth.protect();
  }

  return intlMiddleware(req);
});

export const config = {
  // Note: The common regex matcher '/((?!api|_next|_vercel|.*\..*).*)' does NOT
  // work correctly in Next.js 16 with Turbopack — it silently fails to match
  // dynamic routes like /ru or /en. Using an explicit matcher instead.
  matcher: [
    '/',
    '/(ru|en)/:path*',
    '/(ru|en)',
  ],
};














