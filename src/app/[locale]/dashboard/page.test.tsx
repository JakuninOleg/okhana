import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

vi.mock('@clerk/nextjs', () => ({
  useClerk: () => ({ signOut: vi.fn() }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    if (key === 'signOut') return 'Sign out';
    return key;
  },
}));

const mockAuth = vi.hoisted(() => vi.fn());
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

const mockRedirect = vi.hoisted(() => vi.fn((arg: unknown) => {
  void arg;
  throw new Error('NEXT_REDIRECT');
}));
vi.mock('@/i18n/navigation', () => ({
  redirect: (arg: unknown) => mockRedirect(arg),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: () =>
    Promise.resolve((key: string, vars?: Record<string, string>) => {
      if (key === 'greeting') return `Hello, ${vars?.email ?? ''}`;
      if (key === 'signOut') return 'Sign out';
      return key;
    }),
}));

const mockGetDashboardFamilyData = vi.hoisted(() => vi.fn());
vi.mock('@/features/family/get-dashboard-family', () => ({
  getDashboardFamilyData: (...args: unknown[]) => mockGetDashboardFamilyData(...args),
}));

vi.mock('@/features/chat/family-chat-loader', () => ({
  FamilyChatLoader: () => React.createElement('div', null, 'Family chat'),
}));

vi.mock('@/features/family/invite-code-display', () => ({
  InviteCodeDisplay: ({ code }: { code: string }) =>
    React.createElement('div', null, code),
}));

vi.mock('@/features/family/family-setup-form', () => ({
  FamilySetupForm: () => React.createElement('div', null, 'Family setup'),
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
    mockGetDashboardFamilyData.mockResolvedValue({
      email: 'test@example.com',
      familyName: null,
      familyId: null,
      inviteCode: null,
      hasFamily: false,
      members: [],
      dbError: null,
    });
  });

  it('renders greeting with user email from database', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });

    const { default: DashboardPage } = await import('./page');
    const result = await DashboardPage({
      params: Promise.resolve({ locale: 'en' }),
    }) as React.ReactElement;

    const html = renderToString(result);
    expect(html).toContain('Hello, test@example.com');
  });

  it('falls back to Clerk API when user not found in db', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });
    mockGetDashboardFamilyData.mockResolvedValue({
      email: '',
      familyName: null,
      familyId: null,
      inviteCode: null,
      hasFamily: false,
      members: [],
      dbError: null,
    });

    const { default: DashboardPage } = await import('./page');
    const result = await DashboardPage({
      params: Promise.resolve({ locale: 'en' }),
    }) as React.ReactElement;

    const html = renderToString(result);
    expect(html).toContain('Hello, fallback@example.com');
  });

  it('shows the db error message when the query fails, without falling back silently', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });
    mockGetDashboardFamilyData.mockResolvedValue({
      email: '',
      familyName: null,
      familyId: null,
      inviteCode: null,
      hasFamily: false,
      members: [],
      dbError: 'Connection refused',
    });

    const { default: DashboardPage } = await import('./page');
    const result = await DashboardPage({
      params: Promise.resolve({ locale: 'en' }),
    }) as React.ReactElement;

    const html = renderToString(result);
    expect(html).toContain('Connection refused');
  });

  it('redirects to home page when user is not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const { default: DashboardPage } = await import('./page');

    await expect(
      DashboardPage({ params: Promise.resolve({ locale: 'en' }) }),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockRedirect).toHaveBeenCalledWith({ href: '/', locale: 'en' });
  });

  it('does not crash when members are empty after a partial family load', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });
    mockGetDashboardFamilyData.mockResolvedValue({
      email: 'test@example.com',
      familyName: 'Smiths',
      familyId: 7,
      inviteCode: 'ABCD2345',
      hasFamily: true,
      members: [],
      dbError: null,
    });

    const { default: DashboardPage } = await import('./page');
    const result = await DashboardPage({
      params: Promise.resolve({ locale: 'en' }),
    }) as React.ReactElement;

    const html = renderToString(result);
    expect(html).toContain('ABCD2345');
    expect(html).toContain('familyInfo');
  });
});
