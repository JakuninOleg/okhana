import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock auth() — returns userId or null
const mockAuth = vi.hoisted(() => vi.fn());

// Mock revalidatePath — no-op, asserted on success
const mockRevalidatePath = vi.hoisted(() => vi.fn());
const mockInvalidateDashboardFamilyCache = vi.hoisted(() => vi.fn());
const mockInvalidateCachedChatContext = vi.hoisted(() => vi.fn());

// Mock generateInviteCode — deterministic for happy-path assertions
const mockGenerateInviteCode = vi.hoisted(() => vi.fn());
const mockEnsureDbUser = vi.hoisted(() => vi.fn());

vi.mock('@/features/family/get-dashboard-family', () => ({
  invalidateDashboardFamilyCache: (...args: unknown[]) => mockInvalidateDashboardFamilyCache(...args),
}));

vi.mock('@/features/chat/chat-context-cache', () => ({
  invalidateCachedChatContext: (...args: unknown[]) => mockInvalidateCachedChatContext(...args),
}));

vi.mock('@/lib/server/users/ensure-db-user', () => ({
  ensureDbUser: (...args: unknown[]) => mockEnsureDbUser(...args),
}));

vi.mock('@/lib/server/rate-limit', () => ({
  consumeRateLimit: () => ({ ok: true, retryAfterSec: 0 }),
}));

vi.mock('@/lib/server/db/client', () => ({
  withDbRetry: (operation: () => Promise<unknown>) => operation(),
}));

vi.mock('@/lib/server/db/schema', () => ({
  users: { id: 'id', clerkId: 'clerk_id', familyId: 'family_id', familyRole: 'family_role' },
  families: { id: 'id', inviteCode: 'invite_code', ownerId: 'owner_id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

const mockSelectLimit = vi.hoisted(() => vi.fn());
const mockInsertReturning = vi.hoisted(() => vi.fn());
const mockUpdateWhere = vi.hoisted(() => vi.fn());
const mockUpdateReturning = vi.hoisted(() => vi.fn());

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
        returning: vi.fn(() => mockInsertReturning()),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn((...args: unknown[]) => {
          const chain = mockUpdateWhere(...args);
          if (chain && typeof chain === 'object' && 'returning' in chain) {
            return chain;
          }
          return {
            returning: vi.fn(() => mockUpdateReturning()),
          };
        }),
      })),
    })),
  },
}));

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

  it('returns error when the user is not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { createFamily } = await loadActions();

    await expect(createFamily(formData({ name: 'Smiths' }))).resolves.toEqual({
      ok: false,
      error: 'not_authenticated',
    });
    expect(mockEnsureDbUser).not.toHaveBeenCalled();
  });

  it('returns error when the family name is empty', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    const { createFamily } = await loadActions();

    await expect(createFamily(formData({ name: '' }))).resolves.toEqual({
      ok: false,
      error: 'family_name_required',
    });
    expect(mockEnsureDbUser).not.toHaveBeenCalled();
  });

  it('returns error when the user is not found in the database', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    mockEnsureDbUser.mockResolvedValue(null);
    const { createFamily } = await loadActions();

    await expect(createFamily(formData({ name: 'Smiths' }))).resolves.toEqual({
      ok: false,
      error: 'user_not_found',
    });
  });

  it('returns error when the user already belongs to a family', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    mockEnsureDbUser.mockResolvedValue({ id: 1, familyId: 5 });
    const { createFamily } = await loadActions();

    await expect(createFamily(formData({ name: 'Smiths' }))).resolves.toEqual({
      ok: false,
      error: 'already_in_family',
    });
    expect(mockInsertReturning).not.toHaveBeenCalled();
  });

  it('creates a family, links the user as owner, and revalidates the dashboard', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    mockEnsureDbUser.mockResolvedValue({ id: 1, familyId: null });
    mockInsertReturning.mockResolvedValue([{ id: 10 }]);
    mockUpdateWhere.mockResolvedValue(undefined);
    const { createFamily } = await loadActions();

    await expect(createFamily(formData({ name: '  Smiths  ' }))).resolves.toEqual({ ok: true });

    expect(mockGenerateInviteCode).toHaveBeenCalledOnce();
    expect(mockInsertReturning).toHaveBeenCalledOnce();
    expect(mockUpdateWhere).toHaveBeenCalledOnce();
    expect(mockInvalidateDashboardFamilyCache).toHaveBeenCalledWith('user_1');
    expect(mockInvalidateCachedChatContext).toHaveBeenCalledWith('user_1');
    expect(mockRevalidatePath).toHaveBeenCalledWith(
      '/[locale]/dashboard',
      'page',
    );
  });
});

describe('joinFamily', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateInviteCode.mockReturnValue('ABCD2345');
  });

  it('returns error when the user is not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { joinFamily } = await loadActions();

    await expect(joinFamily(formData({ inviteCode: 'ABCD2345' }))).resolves.toEqual({
      ok: false,
      error: 'not_authenticated',
    });
  });

  it('returns error when the invite code is empty', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    const { joinFamily } = await loadActions();

    await expect(joinFamily(formData({ inviteCode: '' }))).resolves.toEqual({
      ok: false,
      error: 'invite_code_required',
    });
  });

  it('returns error when the user already belongs to a family', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    mockEnsureDbUser.mockResolvedValue({ id: 1, familyId: 5 });
    const { joinFamily } = await loadActions();

    await expect(joinFamily(formData({ inviteCode: 'ABCD2345' }))).resolves.toEqual({
      ok: false,
      error: 'already_in_family',
    });
  });

  it('returns error when the invite code does not match any family', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    mockEnsureDbUser.mockResolvedValue({ id: 1, familyId: null });
    mockSelectLimit.mockResolvedValueOnce([]);
    const { joinFamily } = await loadActions();

    await expect(joinFamily(formData({ inviteCode: 'nope1234' }))).resolves.toEqual({
      ok: false,
      error: 'invalid_invite_code',
    });
    expect(mockUpdateWhere).not.toHaveBeenCalled();
  });

  it('joins the family as an adult and revalidates the dashboard', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    mockEnsureDbUser.mockResolvedValue({ id: 1, familyId: null });
    mockSelectLimit.mockResolvedValueOnce([{ id: 10 }]);
    mockUpdateWhere.mockResolvedValue(undefined);
    const { joinFamily } = await loadActions();

    await expect(joinFamily(formData({ inviteCode: 'abcd2345' }))).resolves.toEqual({ ok: true });

    expect(mockUpdateWhere).toHaveBeenCalledOnce();
    expect(mockInvalidateDashboardFamilyCache).toHaveBeenCalledWith('user_1');
    expect(mockInvalidateCachedChatContext).toHaveBeenCalledWith('user_1');
    expect(mockRevalidatePath).toHaveBeenCalledWith(
      '/[locale]/dashboard',
      'page',
    );
  });
});
