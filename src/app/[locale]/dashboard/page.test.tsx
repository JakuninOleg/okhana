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

// Mock db query — supports both the main query (select → from → leftJoin → where → limit)
// and the members query (select → from → where).
const mockDbSelect = vi.fn();
const mockMembersDbSelect = vi.fn();
const mockWhere = vi.fn(() => ({
  limit: vi.fn(() => mockDbSelect()),
}));
const mockMembersWhere = vi.fn(() => mockMembersDbSelect());
vi.mock('@/lib/server/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          where: mockWhere,
        })),
        where: mockMembersWhere,
      })),
    })),
  },
}));

vi.mock('@/lib/server/db/schema', () => ({
  users: { email: 'email', clerkId: 'clerk_id', familyId: 'family_id', familyRole: 'family_role' },
  families: { id: 'id', name: 'name', inviteCode: 'invite_code' },
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
    mockDbSelect
      .mockResolvedValueOnce([{ email: 'test@example.com', familyId: null, familyName: null, inviteCode: null }]);

    const { default: DashboardPage } = await import('./page');

    const result = await DashboardPage({
      params: Promise.resolve({ locale: 'en' }),
    }) as React.ReactElement;

    const html = renderToString(result);
    expect(html).toContain('Hello, test@example.com');
  });

  it('falls back to Clerk API when user not found in db', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });
    mockDbSelect
      .mockResolvedValueOnce([]);

    const { default: DashboardPage } = await import('./page');

    const result = await DashboardPage({
      params: Promise.resolve({ locale: 'en' }),
    }) as React.ReactElement;

    const html = renderToString(result);
    expect(html).toContain('Hello, fallback@example.com');
  });

  it('shows the db error message when the query fails, without falling back silently', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });
    mockDbSelect
      .mockRejectedValueOnce(new Error('Connection refused'));

    const { default: DashboardPage } = await import('./page');

    const result = await DashboardPage({
      params: Promise.resolve({ locale: 'en' }),
    }) as React.ReactElement;

    const html = renderToString(result);
    // On DB failure the page surfaces the error instead of silently falling
    // back — see src/app/[locale]/dashboard/page.tsx catch block.
    expect(html).toContain('Connection refused');
  });

  it('renders sign-out button with correct locale', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });
    mockDbSelect
      .mockResolvedValueOnce([{ email: 'test@example.com', familyId: null, familyName: null, inviteCode: null }]);

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

  it('does not crash when the members query fails (defence-in-depth)', async () => {
    // Regression: the members select was unguarded — a connection drop there
    // crashed the entire Server Component render in production, surfacing as
    // a generic "An error occurred in the Server Components render".
    mockAuth.mockResolvedValue({ userId: 'user_123' });
    mockDbSelect.mockResolvedValueOnce([
      { email: 'test@example.com', familyId: 7, familyName: 'Smiths', inviteCode: 'ABCD2345' },
    ]);
    mockMembersDbSelect.mockRejectedValueOnce(new Error('Connection lost'));

    const { default: DashboardPage } = await import('./page');

    // Should resolve, not reject — the error is caught and logged.
    const result = await DashboardPage({
      params: Promise.resolve({ locale: 'en' }),
    }) as React.ReactElement;

    const html = renderToString(result);
    // Family info block renders (invite code shown) — the members query
    // failure was caught and did not crash the page.
    expect(html).toContain('ABCD2345');
    expect(html).toContain('familyInfo');
  });
});
