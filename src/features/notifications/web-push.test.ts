import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSetVapidDetails = vi.hoisted(() => vi.fn());
const mockSendNotification = vi.hoisted(() => vi.fn());
const mockSelectWhere = vi.hoisted(() => vi.fn());
const mockDeleteWhere = vi.hoisted(() => vi.fn());

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: (...args: unknown[]) => mockSetVapidDetails(...args),
    sendNotification: (...args: unknown[]) => mockSendNotification(...args),
  },
}));

vi.mock('@/lib/server/db/client', () => ({
  withDbRetry: (operation: () => Promise<unknown>) => operation(),
}));

vi.mock('@/lib/server/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: (...args: unknown[]) => mockSelectWhere(...args),
        limit: vi.fn(() => mockSelectWhere()),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
    delete: vi.fn(() => ({
      where: (...args: unknown[]) => mockDeleteWhere(...args),
    })),
  },
}));

vi.mock('@/lib/server/db/schema', () => ({
  pushSubscriptions: {
    id: 'id',
    userId: 'user_id',
    endpoint: 'endpoint',
    p256dh: 'p256dh',
    auth: 'auth',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  inArray: vi.fn((...args: unknown[]) => args),
}));

describe('web-push helpers', () => {
  const previousPublic = process.env.VAPID_PUBLIC_KEY;
  const previousPrivate = process.env.VAPID_PRIVATE_KEY;

  beforeEach(() => {
    vi.resetModules();
    mockSetVapidDetails.mockReset();
    mockSendNotification.mockReset();
    mockSelectWhere.mockReset();
    mockDeleteWhere.mockReset();
    process.env.VAPID_PUBLIC_KEY = 'public-test';
    process.env.VAPID_PRIVATE_KEY = 'private-test';
  });

  afterEach(() => {
    process.env.VAPID_PUBLIC_KEY = previousPublic;
    process.env.VAPID_PRIVATE_KEY = previousPrivate;
  });

  it('getVapidPublicKey returns null when unset', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    const { getVapidPublicKey } = await import('./web-push');
    expect(getVapidPublicKey()).toBeNull();
  });

  it('sendPushToUsers no-ops without VAPID', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    const { sendPushToUsers } = await import('./web-push');
    await sendPushToUsers([1], { title: 'Okhana', body: 'x' });
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('sendPushToUsers delivers to stored subscriptions', async () => {
    mockSelectWhere.mockResolvedValue([
      {
        id: 9,
        userId: 2,
        endpoint: 'https://push.example/sub',
        p256dh: 'p',
        auth: 'a',
      },
    ]);
    mockSendNotification.mockResolvedValue(undefined);
    const { sendPushToUsers } = await import('./web-push');

    await sendPushToUsers([2], { title: 'Okhana', body: 'Buy milk', url: '/dashboard' });

    expect(mockSetVapidDetails).toHaveBeenCalled();
    expect(mockSendNotification).toHaveBeenCalledWith(
      {
        endpoint: 'https://push.example/sub',
        keys: { p256dh: 'p', auth: 'a' },
      },
      expect.stringContaining('Buy milk'),
    );
  });

  it('sendPushToUsers drops expired subscriptions (410)', async () => {
    mockSelectWhere.mockResolvedValue([
      {
        id: 9,
        userId: 2,
        endpoint: 'https://push.example/gone',
        p256dh: 'p',
        auth: 'a',
      },
    ]);
    mockSendNotification.mockRejectedValue({ statusCode: 410 });
    mockDeleteWhere.mockResolvedValue(undefined);
    const { sendPushToUsers } = await import('./web-push');

    await sendPushToUsers([2], { title: 'Okhana', body: 'x' });
    expect(mockDeleteWhere).toHaveBeenCalled();
  });
});
