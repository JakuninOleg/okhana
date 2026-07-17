import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

// Mock auth() — returns userId or null
const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
  clerkClient: () => Promise.resolve({
    users: {
      getUser: vi.fn().mockResolvedValue({
        emailAddresses: [{ emailAddress: 'fallback@example.com' }],
      }),
    },
  }),
}));

// Mock locale-aware redirect from @/i18n/navigation.
// The real module pulls in next-intl/navigation which doesn't resolve in the
// vitest Node environment, so we stub it and capture calls.
// next-intl's redirect throws internally (like Next.js redirect) to halt
// rendering, so the mock throws too.
const mockRedirect = vi.fn((arg: unknown) => {
  void arg;
  throw new Error('NEXT_REDIRECT');
});
vi.mock('@/i18n/navigation', () => ({
  redirect: (arg: unknown) => mockRedirect(arg),
}));

// Mock next-intl/server translations
vi.mock('next-intl/server', () => ({
  getTranslations: () =>
    Promise.resolve((key: string, vars?: Record<string, string>) => {
      if (key === 'greeting') return `Hello, ${vars?.email ?? ''}`;
      if (key === 'signOut') return 'Sign out';
      return key;
    }),
}));

// Mock db query
const mockDbSelect = vi.fn();
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

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}));

// Mock the client component to avoid rendering Clerk context
vi.mock('./SignOutButtonClient', () => ({
  SignOutButtonClient: ({ locale }: { locale: string }) =>
    React.createElement('button', { 'data-locale': locale }, 'Sign out'),
}));

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

function renderToString(element: React.ReactElement): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactDOMServer = require('react-dom/server');
    return ReactDOMServer.renderToStaticMarkup(element);
  } catch {
    return extractText(element);
  }
}

describe('Dashboard page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders greeting with user email from database', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });
    mockDbSelect.mockResolvedValue([{ email: 'test@example.com' }]);

    const { default: DashboardPage } = await import('./page');

    const result = await DashboardPage({
      params: Promise.resolve({ locale: 'en' }),
    }) as React.ReactElement;

    const html = renderToString(result);
    expect(html).toContain('Hello, test@example.com');
  });

  it('falls back to Clerk API when user not found in db', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });
    mockDbSelect.mockResolvedValue([]);

    const { default: DashboardPage } = await import('./page');

    const result = await DashboardPage({
      params: Promise.resolve({ locale: 'en' }),
    }) as React.ReactElement;

    const html = renderToString(result);
    expect(html).toContain('Hello, fallback@example.com');
  });

  it('falls back to Clerk API when db query fails', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });
    mockDbSelect.mockRejectedValue(new Error('Connection refused'));

    const { default: DashboardPage } = await import('./page');

    const result = await DashboardPage({
      params: Promise.resolve({ locale: 'en' }),
    }) as React.ReactElement;

    const html = renderToString(result);
    expect(html).toContain('Hello, fallback@example.com');
  });

  it('renders sign-out button with correct locale', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });
    mockDbSelect.mockResolvedValue([{ email: 'test@example.com' }]);

    const { default: DashboardPage } = await import('./page');

    const result = await DashboardPage({
      params: Promise.resolve({ locale: 'ru' }),
    }) as React.ReactElement;

    const html = renderToString(result);
    expect(html).toContain('Sign out');
    expect(html).toContain('data-locale="ru"');
  });

  it('redirects to home page when user is not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const { default: DashboardPage } = await import('./page');

    // redirect() throws to halt rendering (mirrors next-intl behaviour),
    // so the page rejects. We assert the redirect was invoked with the
    // expected locale-aware target.
    await expect(
      DashboardPage({ params: Promise.resolve({ locale: 'en' }) }),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockRedirect).toHaveBeenCalledWith({ href: '/', locale: 'en' });
  });
});
