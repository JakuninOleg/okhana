import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

const mockInsertValues = vi.fn(() => ({ onConflictDoNothing: vi.fn() }));
const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
const mockDeleteWhere = vi.fn();

vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation(function (this: { verify: (body: string) => unknown }) {
    this.verify = (body: string) => JSON.parse(body);
  }),
}));

vi.mock('@/lib/server/db', () => ({
  db: {
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({ set: mockUpdateSet })),
    delete: vi.fn(() => ({ where: mockDeleteWhere })),
  },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Map([
    ['svix-id', 'test-id'],
    ['svix-timestamp', '12345'],
    ['svix-signature', 'test-signature'],
  ])),
}));

function buildRequest(payload: object) {
  return new Request('http://localhost/api/webhooks/clerk', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

describe('POST /api/webhooks/clerk', () => {
  beforeEach(() => {
    process.env.CLERK_WEBHOOK_SECRET = 'test-secret';
    vi.clearAllMocks();
  });

  it('returns 500 if webhook secret is not configured', async () => {
    delete process.env.CLERK_WEBHOOK_SECRET;
    const res = await POST(buildRequest({}));
    expect(res.status).toBe(500);
  });

  it('inserts a new user on user.created', async () => {
    const res = await POST(buildRequest({
      type: 'user.created',
      data: {
        id: 'user_123',
        email_addresses: [{ email_address: 'test@example.com' }],
        first_name: 'Ivan',
        last_name: 'Petrov',
        image_url: 'https://example.com/avatar.png',
      },
    }));
    expect(res.status).toBe(200);
    expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({
      clerkId: 'user_123',
      email: 'test@example.com',
      name: 'Ivan Petrov',
    }));
  });

  it('updates an existing user on user.updated', async () => {
    const res = await POST(buildRequest({
      type: 'user.updated',
      data: {
        id: 'user_123',
        email_addresses: [{ email_address: 'new@example.com' }],
        first_name: 'Ivan',
        last_name: 'Petrov',
        image_url: null,
      },
    }));
    expect(res.status).toBe(200);
    expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({
      email: 'new@example.com',
    }));
  });

  it('deletes a user on user.deleted', async () => {
    const res = await POST(buildRequest({
      type: 'user.deleted',
      data: { id: 'user_123' },
    }));
    expect(res.status).toBe(200);
    expect(mockDeleteWhere).toHaveBeenCalled();
  });
});
