import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock auth() — returns userId or null
const mockAuth = vi.hoisted(() => vi.fn());

// Mock revalidatePath — a no-op, but assert it was called on success
const mockRevalidatePath = vi.hoisted(() => vi.fn());

// Mock generateInviteCode — deterministic for happy-path assertions
const mockGenerateInviteCode = vi.hoisted(() => vi.fn());

vi.mock('@/lib/server/db/schema', () => ({
  users: { id: 'id', clerkId: 'clerk_id', familyId: 'family_id', familyRole: 'family_role' },
  families: { id: 'id', inviteCode: 'invite_code' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}));

// Mock db — chainable select/insert/update. Each query builder records its
// call so tests can assert which path was taken.
const mockSelectLimit = vi.hoisted(() => vi.fn());
const mockInsertReturning = vi.hoisted(() => vi.fn());
const mockUpdateWhere = vi.hoisted(() => vi.fn());

vi.mock('@/lib/server/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          // users lookup uses .limit(1)
          limit: vi.fn(() => mockSelectLimit()),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => mockInsertReturning()),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => mockUpdateWhere()),
      })),
    })),
  },
}));

// joinFamily runs a second select (families lookup). Both selects share the
// select().from().where().limit() chain, resolved by mockSelectLimit — tests
// use mockResolvedValueOnce to feed the user-lookup then the family-lookup.

async function loadActions() {
  vi.doMock('@clerk/nextjs/server', () => ({
    auth: () => mockAuth(),
  }));
  vi.doMock('next/cache', () => ({
    revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  }));
  vi.doMock('@/lib/server/utils', () => ({
    generateInviteCode: () => mockGenerateInviteCode(),
  }));
  // Fresh import so vi.mock hoisting + clearAllMocks compose predictably
  return await import('./actions');
}

function formData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe('createFamily', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateInviteCode.mockReturnValue('ABCD2345');
  });

  it('throws when the user is not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { createFamily } = await loadActions();

    await expect(createFamily(formData({ name: 'Smiths' }))).rejects.toThrow(
      'Not authenticated',
    );
    expect(mockSelectLimit).not.toHaveBeenCalled();
  });

  it('throws when the family name is empty', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    const { createFamily } = await loadActions();

    await expect(createFamily(formData({ name: '' }))).rejects.toThrow(
      'Family name is required',
    );
    expect(mockSelectLimit).not.toHaveBeenCalled();
  });

  it('throws when the user is not found in the database', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    mockSelectLimit.mockResolvedValue([]);
    const { createFamily } = await loadActions();

    await expect(createFamily(formData({ name: 'Smiths' }))).rejects.toThrow(
      'User not found',
    );
  });

  it('throws when the user already belongs to a family', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    mockSelectLimit.mockResolvedValue([{ id: 1, familyId: 5 }]);
    const { createFamily } = await loadActions();

    await expect(createFamily(formData({ name: 'Smiths' }))).rejects.toThrow(
      'You already belong to a family',
    );
    expect(mockInsertReturning).not.toHaveBeenCalled();
  });

  it('creates a family, links the user as owner, and revalidates the dashboard', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    mockSelectLimit.mockResolvedValue([{ id: 1, familyId: null }]);
    mockInsertReturning.mockResolvedValue([{ id: 10 }]);
    mockUpdateWhere.mockResolvedValue(undefined);
    const { createFamily } = await loadActions();

    await createFamily(formData({ name: '  Smiths  ' }));

    // Invite code generated
    expect(mockGenerateInviteCode).toHaveBeenCalledOnce();
    // Family inserted
    expect(mockInsertReturning).toHaveBeenCalledOnce();
    // User updated to owner
    expect(mockUpdateWhere).toHaveBeenCalledOnce();
    // Dashboard revalidated
    expect(mockRevalidatePath).toHaveBeenCalledWith(
      '/[locale]/dashboard',
      'page',
    );
  });
});

describe('joinFamily', () => {
  // joinFamily performs two selects: users lookup then families lookup.
  // mockSelectLimit serves both sequentially via mockResolvedValueOnce.
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateInviteCode.mockReturnValue('ABCD2345');
  });

  it('throws when the user is not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { joinFamily } = await loadActions();

    await expect(joinFamily(formData({ inviteCode: 'ABCD2345' }))).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('throws when the invite code is empty', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    const { joinFamily } = await loadActions();

    await expect(joinFamily(formData({ inviteCode: '' }))).rejects.toThrow(
      'Invite code is required',
    );
  });

  it('throws when the user already belongs to a family', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    mockSelectLimit.mockResolvedValue([{ id: 1, familyId: 5 }]);
    const { joinFamily } = await loadActions();

    await expect(joinFamily(formData({ inviteCode: 'ABCD2345' }))).rejects.toThrow(
      'You already belong to a family',
    );
  });

  it('throws when the invite code does not match any family', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    // first select: user lookup (no family) → second select: family lookup (none)
    mockSelectLimit
      .mockResolvedValueOnce([{ id: 1, familyId: null }])
      .mockResolvedValueOnce([]);
    const { joinFamily } = await loadActions();

    await expect(joinFamily(formData({ inviteCode: 'nope1234' }))).rejects.toThrow(
      'Invalid invite code',
    );
    expect(mockUpdateWhere).not.toHaveBeenCalled();
  });

  it('joins the family as an adult and revalidates the dashboard', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    mockSelectLimit
      .mockResolvedValueOnce([{ id: 1, familyId: null }])
      .mockResolvedValueOnce([{ id: 10 }]);
    mockUpdateWhere.mockResolvedValue(undefined);
    const { joinFamily } = await loadActions();

    // Lowercase input is normalised to uppercase before lookup
    await joinFamily(formData({ inviteCode: 'abcd2345' }));

    expect(mockUpdateWhere).toHaveBeenCalledOnce();
    expect(mockRevalidatePath).toHaveBeenCalledWith(
      '/[locale]/dashboard',
      'page',
    );
  });
});
