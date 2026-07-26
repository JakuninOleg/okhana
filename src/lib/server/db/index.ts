import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import { getSql } from './client';

type AppDb = PostgresJsDatabase<typeof schema>;

type GlobalDb = typeof globalThis & {
  __okhanaDb?: AppDb;
  __okhanaDbInvalid?: boolean;
};

function createDb(): AppDb {
  return drizzle(getSql(), { schema });
}

export function getDb(): AppDb {
  const globalDb = globalThis as GlobalDb;
  if (!globalDb.__okhanaDb || globalDb.__okhanaDbInvalid) {
    globalDb.__okhanaDb = createDb();
    globalDb.__okhanaDbInvalid = false;
  }
  return globalDb.__okhanaDb;
}

/**
 * Keep existing `import { db }` call sites working while always resolving to
 * the current SQL client (important after reconnect/retry).
 */
export const db: AppDb = new Proxy({} as AppDb, {
  get(_target, property, receiver) {
    const current = getDb();
    const value = Reflect.get(current as object, property, receiver);
    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(current);
    }
    return value;
  },
});
