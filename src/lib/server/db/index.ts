import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Serverless-optimised configuration (Vercel).
//
// pg.Pool keeps idle connections open and relies on background timers, but
// Vercel freezes the function's process the instant the response is sent.
// Any query that hasn't fully completed by then is silently dropped — the
// client gets a 200, the DB never receives the INSERT/UPDATE. This is why
// the Clerk webhook "succeeded" but no user row appeared in Supabase.
//
// postgres.js is single-connection by default and finishes work inline.
// We force max connections to 1 (each serverless invocation is isolated
// and should not try to multiplex), disable prepared statements (required
// for Supabase's PgBouncer pooler in transaction mode on port 6543), and
// keep idle/connect timeouts short so a stuck socket never blocks a request.
const client = postgres(process.env.DATABASE_URL!, {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 10,
  prepare: false,
});

export const db = drizzle(client, { schema });
