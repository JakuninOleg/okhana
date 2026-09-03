import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockClerkGetUser = vi.hoisted(() => vi.fn());
const mockSelectLimit = vi.hoisted(() => vi.fn());
const mockUpdateReturning = vi.hoisted(() => vi.fn());
const mockInsertReturning = vi.hoisted(() => vi.fn());
const mockDeleteWhere = vi.hoisted(() => vi.fn(async () => undefined));
const mockInvalidateDashboardFamilyCache = vi.hoisted(() => vi.fn());

vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: vi.fn(async () => ({
    users: { getUser: mockClerkGetUser },
  })),
}));

vi.mock('@/features/family/family-cache', () => ({
  invalidateDashboardFamilyCache: (...args: unknown[]) =>
    mockInvalidateDashboardFamilyCache(...args),
}));

vi.mock('@/lib/server/db/schema', () => ({
  users: {
    id: 'id',
    clerkId: 'clerk_id',
    email: 'email',
    name: 'name',
    avatarUrl: 'avatar_url',
    familyId: 'family_id',
    familyRole: 'family_role',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  ne: vi.fn(),
}));

vi.mock('@/lib/server/db/client', () => ({
  withDbRetry: (operation: () => Promise<unknown>) => operation(),
}));

vi.mock('@/lib/server/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => mockSelectLimit()),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => mockUpdateReturning()),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(() => mockInsertReturning()),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => mockDeleteWhere()),
    })),
  },
}));

describe('ensureDbUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the existing row when clerk id already matches', async () => {
    const existing = {
      id: 1,
      clerkId: 'user_a',
      email: 'a@example.com',
      familyId: 9,
      familyRole: 'owner',
    };
    mockSelectLimit.mockResolvedValueOnce([existing]);

    const { ensureDbUser } = await import('./ensure-db-user');
    await expect(ensureDbUser('user_a')).resolves.toEqual(existing);
    expect(mockClerkGetUser).not.toHaveBeenCalled();
  });

  it('re-links an existing email when Clerk issued a new user id', async () => {
    mockSelectLimit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 1,
        clerkId: 'user_old',
        email: 'oleg@example.com',
        familyId: 1,
        familyRole: 'owner',
      }])
      .mockResolvedValueOnce([]);

    mockClerkGetUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'oleg@example.com' }],
      firstName: 'Oleg',
      lastName: null,
      imageUrl: 'https://img.example/avatar.png',
    });

    const linked = {
      id: 1,
      clerkId: 'user_new',
      email: 'oleg@example.com',
      familyId: 1,
      familyRole: 'owner',
    };
    mockUpdateReturning.mockResolvedValueOnce([linked]);

    const { ensureDbUser } = await import('./ensure-db-user');
    await expect(ensureDbUser('user_new')).resolves.toEqual(linked);
    expect(mockInvalidateDashboardFamilyCache).toHaveBeenCalledWith('user_new');
    expect(mockInvalidateDashboardFamilyCache).toHaveBeenCalledWith('user_old');
  });

  it('creates a new user when neither clerk id nor email exists', async () => {
    mockSelectLimit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    mockClerkGetUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'new@example.com' }],
      firstName: 'New',
      lastName: 'User',
      imageUrl: null,
    });

    const created = {
      id: 2,
      clerkId: 'user_new',
      email: 'new@example.com',
      familyId: null,
      familyRole: null,
    };
    mockInsertReturning.mockResolvedValueOnce([created]);

    const { ensureDbUser } = await import('./ensure-db-user');
    await expect(ensureDbUser('user_new')).resolves.toEqual(created);
  });
});
