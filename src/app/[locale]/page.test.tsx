import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock auth() — returns userId or null depending on test scenario
const mockAuth = vi.hoisted(() => vi.fn());
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

// Mock next-intl/server translations
vi.mock('next-intl/server', () => ({
  getTranslations: () =>
    Promise.resolve((key: string, vars?: Record<string, string>) => {
      if (key === 'signIn') return 'Sign in';
      if (key === 'greeting') return `Hello, ${vars?.email ?? ''}`;
      if (key === 'signOut') return 'Sign out';
      return key;
    }),
}));

// Mock redirect from i18n/navigation — capture calls instead of actually redirecting
const mockRedirect = vi.hoisted(() => vi.fn());
vi.mock('@/i18n/navigation', () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) =>
    React.createElement('a', { href, className }, children),
}));

// Mock db query — returns user email or empty array
const mockDbSelect = vi.hoisted(() => vi.fn());
vi.mock('@/lib/server/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => mockDbSelect()),
        })),
      })),
    })),
  },
}));

vi.mock('@/lib/server/db/schema', () => ({
  users: { email: 'email', clerkId: 'clerk_id' },
}));

// Mock drizzle-orm eq
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}));

// Must import React for createElement in mocks
import React from 'react';

describe('Home page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects authenticated users to dashboard', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });

    const { default: Home } = await import('./page');

    await Home({
      params: Promise.resolve({ locale: 'en' }),
    });

    expect(mockRedirect).toHaveBeenCalledWith({
      href: '/dashboard',
      locale: 'en',
    });
  });

  it('renders sign-in button for unauthenticated users', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const { default: Home } = await import('./page');

    const result = await Home({
      params: Promise.resolve({ locale: 'en' }),
    }) as React.ReactElement;

    expect(mockRedirect).not.toHaveBeenCalled();
    // The component renders a <main> with a link containing "Sign in"
    const html = renderToString(result);
    expect(html).toContain('Sign in');
  });
});

// Helper: minimal renderToString for testing server component output
function renderToString(element: React.ReactElement): string {
  // Use a simple recursive approach since we're in a Node environment
  // without react-dom/server being fully configured for Turbopack
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactDOMServer = require('react-dom/server');
    return ReactDOMServer.renderToStaticMarkup(element);
  } catch {
    // Fallback: extract text content from the element tree
    return extractText(element);
  }
}

function extractText(node: unknown): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    const props = (node as React.ReactElement).props as { children?: unknown };
    return extractText(props.children);
  }
  return '';
}
