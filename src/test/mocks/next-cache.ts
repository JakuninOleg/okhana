import { vi } from 'vitest';

export const revalidatePath = vi.fn();
export const revalidateTag = vi.fn();
export const updateTag = vi.fn();

/** Tests run the inner fetch immediately — no cross-request cache. */
export function unstable_cache<T>(
  fn: () => Promise<T>,
  _keyParts?: string[],
  _options?: { revalidate?: number | false; tags?: string[] },
): () => Promise<T> {
  return fn;
}
