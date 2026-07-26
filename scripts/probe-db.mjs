import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';

function loadEnvLocal() {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

function summarize(url) {
  const normalized = url.replace(/^postgresql:/i, 'http:');
  const parsed = new URL(normalized);
  return JSON.stringify({
    host: parsed.hostname,
    port: parsed.port || '(default)',
    pgbouncer: /pgbouncer=true/i.test(url),
  });
}

async function probe(label, url) {
  if (!url) {
    console.log(label, 'MISSING');
    return;
  }
  console.log(label, summarize(url));
  const sql = postgres(url, {
    max: 1,
    prepare: false,
    connect_timeout: 5,
    idle_timeout: 5,
  });
  const started = Date.now();
  try {
    const rows = await Promise.race([
      sql`select 1 as ok`,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('probe_timeout_5s')), 5000);
      }),
    ]);
    console.log(label, 'OK', `${Date.now() - started}ms`, rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    console.log(label, 'FAIL', `${Date.now() - started}ms`, message, code);
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

await probe('DATABASE_URL', process.env.DATABASE_URL);
await probe('DIRECT_URL', process.env.DIRECT_URL);
