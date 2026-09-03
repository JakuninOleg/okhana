import dns from 'node:dns';
import postgres from 'postgres';

// Windows/Node often prefer broken IPv6 routes to Supabase; force IPv4 first.
dns.setDefaultResultOrder('ipv4first');

const isDev = process.env.NODE_ENV === 'development';
const isServerless = Boolean(process.env.VERCEL);

/**
 * Per-attempt SQL budget. Hung pooler sockets are reset and retried.
 * Keep this modest — a dead connection should fail fast, not block the mutex.
 */
const ATTEMPT_TIMEOUT_MS = isDev && !isServerless ? 6_000 : 4_000;
const MAX_ATTEMPTS = 3;
const MAX_CONNECTION_AGE_MS = isDev && !isServerless ? 45_000 : 20_000;

type Sql = ReturnType<typeof postgres>;

type GlobalDb = typeof globalThis & {
  __okhanaSql?: Sql;
  __okhanaSqlCreatedAt?: number;
  __okhanaDbInvalid?: boolean;
  __okhanaSqlReset?: Promise<void>;
  __okhanaDbMutex?: Promise<void>;
};

function isTransactionPoolerUrl(url: string): boolean {
  try {
    return new URL(url).port === '6543';
  } catch {
    return /:6543(?:\/|$)/.test(url);
  }
}

function resolveConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not configured');
  }
  return url;
}

function createSql(): Sql {
  const connectionString = resolveConnectionString();
  const usingTransactionPooler = isTransactionPoolerUrl(connectionString);

  const sql = postgres(connectionString, {
    max: 1,
    idle_timeout: isDev && !isServerless ? 120 : 30,
    connect_timeout: 8,
    max_lifetime: 60,
    prepare: false,
    // Transaction pooler cannot safely pipeline concurrent queries on one socket.
    ...(usingTransactionPooler ? { max_pipeline: 1, fetch_types: false } : {}),
    ...(isDev && !isServerless ? { onnotice: () => undefined } : {}),
  });

  (globalThis as GlobalDb).__okhanaSqlCreatedAt = Date.now();
  return sql;
}

export function getSql(): Sql {
  const globalDb = globalThis as GlobalDb;
  if (!globalDb.__okhanaSql) {
    globalDb.__okhanaSql = createSql();
  }
  return globalDb.__okhanaSql;
}

export async function resetSql(): Promise<void> {
  const globalDb = globalThis as GlobalDb;
  if (globalDb.__okhanaSqlReset) {
    await globalDb.__okhanaSqlReset;
    return;
  }

  globalDb.__okhanaSqlReset = (async () => {
    const existing = globalDb.__okhanaSql;
    globalDb.__okhanaSql = undefined;
    globalDb.__okhanaSqlCreatedAt = undefined;
    globalDb.__okhanaDbInvalid = true;
    if (existing) {
      // Do not await a hung end() — timeout 0 forces destroy.
      void existing.end({ timeout: 0 }).catch(() => undefined);
    }
  })();

  try {
    await globalDb.__okhanaSqlReset;
  } finally {
    globalDb.__okhanaSqlReset = undefined;
  }
}

async function recycleAgedConnection(): Promise<void> {
  const globalDb = globalThis as GlobalDb;
  if (!globalDb.__okhanaSql || globalDb.__okhanaSqlCreatedAt == null) {
    return;
  }
  if (Date.now() - globalDb.__okhanaSqlCreatedAt > MAX_CONNECTION_AGE_MS) {
    await resetSql();
  }
}

function walkErrorChain(error: unknown): Array<{ code: string; message: string }> {
  const parts: Array<{ code: string; message: string }> = [];
  const queue: unknown[] = [error];
  const seen = new Set<unknown>();

  while (queue.length > 0 && parts.length < 12) {
    const current = queue.shift();
    if (!current || typeof current !== 'object' || seen.has(current)) {
      continue;
    }
    seen.add(current);

    parts.push({
      code: 'code' in current ? String(current.code) : '',
      message: 'message' in current
        ? String(current.message)
        : String(current),
    });

    if ('cause' in current && current.cause) {
      queue.push(current.cause);
    }
    if ('errors' in current && Array.isArray(current.errors)) {
      for (const nested of current.errors) {
        queue.push(nested);
      }
    }
  }

  return parts;
}

export function isRetriableConnectionError(error: unknown): boolean {
  return walkErrorChain(error).some(({ code, message }) => {
    if (
      code === 'CONNECTION_CLOSED'
      || code === 'CONNECTION_DESTROYED'
      || code === 'CONNECT_TIMEOUT'
      || code === 'ECONNRESET'
      || code === 'ETIMEDOUT'
      || code === 'QUERY_TIMEOUT'
      || code === '57P01'
    ) {
      return true;
    }
    return /ECONNRESET|ETIMEDOUT|EMAXCONN|CONNECTION_DESTROYED|CONNECTION_CLOSED|max clients reached|connection (?:closed|terminated|destroyed|refused)|CONNECT_TIMEOUT|timeout expired|query timeout|write CONNECTION/i
      .test(message);
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(Object.assign(new Error(`Query timeout after ${ms}ms`), { code: 'QUERY_TIMEOUT' }));
    }, ms);

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );

    // After we give up, still attach a no-op so late pooler errors are not unhandled.
    void promise.catch(() => undefined);
  });
}

async function withMutex<T>(operation: () => Promise<T>): Promise<T> {
  const globalDb = globalThis as GlobalDb;
  const previous = globalDb.__okhanaDbMutex ?? Promise.resolve();
  let release!: () => void;
  globalDb.__okhanaDbMutex = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    release();
  }
}

/**
 * Timed attempts with reconnect. Serialized so the single pooler socket
 * never runs concurrent queries (Supabase transaction pooler + max:1).
 */
export async function withDbRetry<T>(operation: () => Promise<T>): Promise<T> {
  return withMutex(async () => {
    await recycleAgedConnection();

    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        const result = await withTimeout(operation(), ATTEMPT_TIMEOUT_MS);
        return result;
      } catch (error) {
        lastError = error;
        if (!isRetriableConnectionError(error) || attempt === MAX_ATTEMPTS - 1) {
          throw error;
        }
        await resetSql();
      }
    }

    throw lastError;
  });
}
