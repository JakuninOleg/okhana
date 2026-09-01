import dns from 'node:dns';
import postgres from 'postgres';

// Windows/Node often prefer broken IPv6 routes to Supabase; force IPv4 first.
dns.setDefaultResultOrder('ipv4first');

const isDev = process.env.NODE_ENV === 'development';
const isServerless = Boolean(process.env.VERCEL);

/** Fail fast — hung pooler sockets otherwise block chat for minutes. */
const ATTEMPT_TIMEOUT_MS = 4_000;
const MAX_CONNECTION_AGE_MS = 20_000;

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
    idle_timeout: 10,
    connect_timeout: 3,
    max_lifetime: 30,
    prepare: false,
    ...(usingTransactionPooler ? { max_pipeline: 1 } : {}),
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
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    parts.push({
      code: 'code' in current ? String(current.code) : '',
      message: 'message' in current ? String(current.message) : '',
    });
    current = 'cause' in current ? current.cause : undefined;
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
    return /ECONNRESET|ETIMEDOUT|EMAXCONN|max clients reached|connection (?:closed|terminated|destroyed|refused)|CONNECT_TIMEOUT|timeout expired|query timeout/i
      .test(message);
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error(`Query timeout after ${ms}ms`), { code: 'QUERY_TIMEOUT' }));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
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
 * One timed attempt + one reconnect. Serialized in-process so hung sockets
 * cannot stack up and block every later request.
 */
export async function withDbRetry<T>(operation: () => Promise<T>): Promise<T> {
  return withMutex(async () => {
    await recycleAgedConnection();
    const run = (): Promise<T> => withTimeout(operation(), ATTEMPT_TIMEOUT_MS);

    try {
      return await run();
    } catch (error) {
      if (!isRetriableConnectionError(error)) {
        throw error;
      }
      await resetSql();
      return run();
    }
  });
}
