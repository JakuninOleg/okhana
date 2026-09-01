import { vi } from 'vitest';

export type WebhookEvent = {
  type: string;
  data: unknown;
};

export const auth = vi.fn(async () => ({ userId: null }));

export const clerkClient = vi.fn(async () => ({
  users: {
    getUser: vi.fn(async () => ({
      emailAddresses: [{ emailAddress: 'fallback@example.com' }],
    })),
  },
}));

export const clerkMiddleware = vi.fn((handler: unknown) => handler);
