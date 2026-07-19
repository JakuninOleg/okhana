import { clerkMiddleware } from '@clerk/nextjs/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

const vercelUrl = process.env.VERCEL_URL;

const authorizedParties = [
  'https://okhanahome.com',
  'https://www.okhanahome.com',
  'http://localhost:3000',
  'https://okhana-git-staging-jakunin-olegs-projects.vercel.app',
  ...(vercelUrl ? [`https://${vercelUrl}`] : []),
];

// Following Clerk's guidance after CVE-2026-41248: middleware-only route
// gating via createRouteMatcher()/auth.protect() can be bypassed by crafted
// requests that never reach the middleware's matcher. Route protection must
// happen at the point where the resource is read/mutated (page, layout, API
// route, Server Action) — not solely in middleware.
//
// clerkMiddleware() is kept here only so that auth() has request context
// available in Server Components downstream. It no longer protects routes;
// each protected page is responsible for its own explicit auth() check with
// a redirect (see src/app/[locale]/dashboard/page.tsx for the pattern).
export default clerkMiddleware((auth, req) => {
  return intlMiddleware(req);
}, {
  // Production is served both as okhanahome.com and www.okhanahome.com.
  // authorizedParties prevents subdomain cookie-leaking attacks (CSRF) and
  // must include every origin the app is reachable from — otherwise Clerk
  // rejects the session token and redirects to sign-in in a loop ("Unsafe
  // attempt to load URL ... from frame" console error). Git-staging is for testing
  // on preview vercel environment 
  authorizedParties,
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
