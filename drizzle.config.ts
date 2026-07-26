import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Session/direct URL for DDL; fall back to DATABASE_URL if unset.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
});
