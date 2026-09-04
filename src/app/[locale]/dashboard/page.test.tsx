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
  getTranslations: (opts?: string | { locale?: string; namespace?: string }) => {
    const namespace = typeof opts === 'object' ? opts.namespace : undefined;
    return Promise.resolve((key: string, vars?: Record<string, string>) => {
      if (namespace === 'Dashboard.onboarding' && key === 'welcome') {
        return `Welcome, ${vars?.name ?? ''}`;
      }
      if (key === 'greeting') return `Hello, ${vars?.email ?? ''}`;
      if (key === 'signOut') return 'Sign out';
      return key;
    });
  },
}));

const mockGetDashboardFamilyData = vi.hoisted(() => vi.fn());
vi.mock('@/features/family/get-dashboard-family', () => ({
  getDashboardFamilyData: (...args: unknown[]) => mockGetDashboardFamilyData(...args),
}));

vi.mock('@/features/chat/family-chat-loader', () => ({
  FamilyChatLoader: () => React.createElement('div', null, 'Family chat'),
}));

vi.mock('@/features/tasks/family-tasks-priority', () => ({
  FamilyTasksPriority: () => React.createElement('div', null, 'Tasks priority'),
}));

vi.mock('@/features/tasks/load-dashboard-tasks', () => ({
  loadDashboardActiveTasks: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/features/family/family-hub-menu', () => ({
  FamilyHubMenu: ({
    familyName,
    inviteCode,
    children,
  }: {
    familyName: string;
    inviteCode: string;
    children?: React.ReactNode;
  }) => React.createElement('div', null, familyName, inviteCode, children),
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
      userDisplayName: 'test',
      familyName: null,
      familyId: null,
      inviteCode: null,
      hasFamily: false,
      currentUserId: null,
      currentUserRole: null,
      members: [],
      dbError: null,
    });
  });

  it('renders onboarding welcome when user has no family', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });

    const { default: DashboardPage } = await import('./page');
    const result = await DashboardPage({
      params: Promise.resolve({ locale: 'en' }),
    }) as React.ReactElement;

    const html = renderToString(result);
    expect(html).toContain('Welcome, test');
    expect(html).toContain('Family setup');
  });

  it('uses display name from dashboard family data', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });
    mockGetDashboardFamilyData.mockResolvedValue({
      email: '',
      userDisplayName: 'fallback',
      familyName: null,
      familyId: null,
      inviteCode: null,
      hasFamily: false,
      currentUserId: null,
      currentUserRole: null,
      members: [],
      dbError: null,
    });

    const { default: DashboardPage } = await import('./page');
    const result = await DashboardPage({
      params: Promise.resolve({ locale: 'en' }),
    }) as React.ReactElement;

    const html = renderToString(result);
    expect(html).toContain('Welcome, fallback');
  });

  it('shows the db error message when the query fails, without falling back silently', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });
    mockGetDashboardFamilyData.mockResolvedValue({
      email: '',
      userDisplayName: '',
      familyName: null,
      familyId: null,
      inviteCode: null,
      hasFamily: false,
      currentUserId: null,
      currentUserRole: null,
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
      userDisplayName: 'test',
      familyName: 'Smiths',
      familyId: 7,
      inviteCode: 'ABCD2345',
      hasFamily: true,
      currentUserId: 1,
      currentUserRole: 'owner',
      members: [],
      dbError: null,
    });

    const { default: DashboardPage } = await import('./page');
    const result = await DashboardPage({
      params: Promise.resolve({ locale: 'en' }),
    }) as React.ReactElement;

    const html = renderToString(result);
    expect(html).toContain('Smiths');
    expect(html).toContain('ABCD2345');
    expect(html).toContain('Family chat');
  });
});
