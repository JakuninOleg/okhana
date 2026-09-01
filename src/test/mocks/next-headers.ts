import { vi } from 'vitest';

export const headers = vi.fn(async () => new Map([
  ['svix-id', 'test-id'],
  ['svix-timestamp', '12345'],
  ['svix-signature', 'test-signature'],
]));
