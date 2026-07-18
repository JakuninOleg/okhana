import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock clerkClient — returns a fake user
const mockGetUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: () =>
    Promise.resolve({
      users: { getUser: (id: string) => mockGetUser(id) },
    }),
}));

// Mock db — select for existence check, insert for upsert
const mockSelectLimit = vi.fn();
const mockOnConflictDoNothing = vi.fn();
vi.mock('@/lib/server/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => mockSelectLimit()),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: () => mockOnConflictDoNothing(),
      })),
    })),
  },
}));

vi.mock('@/lib/server/db/schema', () => ({
  users: {
    clerkId: 'clerk_id',
    email: 'email',
    name: 'name',
    avatarUrl: 'avatar_url',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}));

import { ensureUserExists } from './users';

describe('ensureUserExists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns existing user from DB without calling Clerk API or inserting', async () => {
    mockSelectLimit.mockResolvedValue([
      { email: 'db@example.com', name: 'DB User', avatarUrl: 'https://img.test/db.jpg' },
    ]);

    const result = await ensureUserExists('user_123');

    expect(result).toEqual({
      email: 'db@example.com',
      name: 'DB User',
      avatarUrl: 'https://img.test/db.jpg',
    });
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockOnConflictDoNothing).not.toHaveBeenCalled();
  });

  it('fetches from Clerk API and inserts when user is not in DB', async () => {
    mockSelectLimit.mockResolvedValue([]);
    mockGetUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'clerk@example.com' }],
      firstName: 'Clerk',
      lastName: 'User',
      imageUrl: 'https://img.test/clerk.jpg',
    });
    mockOnConflictDoNothing.mockResolvedValue(undefined);

    const result = await ensureUserExists('user_456');

    expect(mockGetUser).toHaveBeenCalledWith('user_456');
    expect(mockOnConflictDoNothing).toHaveBeenCalledOnce();
    expect(result).toEqual({
      email: 'clerk@example.com',
      name: 'Clerk User',
      avatarUrl: 'https://img.test/clerk.jpg',
    });
  });

  it('uses email as name when firstName/lastName are empty', async () => {
    mockSelectLimit.mockResolvedValue([]);
    mockGetUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'noname@example.com' }],
      firstName: null,
      lastName: null,
      imageUrl: null,
    });
    mockOnConflictDoNothing.mockResolvedValue(undefined);

    const result = await ensureUserExists('user_789');

    expect(result.name).toBe('noname@example.com');
    expect(result.avatarUrl).toBeNull();
  });
});
