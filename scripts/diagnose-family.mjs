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

const emailFilter = process.argv[2]?.toLowerCase();

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

const users = emailFilter
  ? await sql`
      SELECT u.id, u.clerk_id, u.email, u.family_id, u.family_role,
             f.name AS family_name, f.invite_code
      FROM users u
      LEFT JOIN families f ON u.family_id = f.id
      WHERE lower(u.email) = ${emailFilter}
      ORDER BY u.id
    `
  : await sql`
      SELECT u.id, u.clerk_id, u.email, u.family_id, u.family_role,
             f.name AS family_name, f.invite_code
      FROM users u
      LEFT JOIN families f ON u.family_id = f.id
      ORDER BY u.id
    `;

const families = await sql`
  SELECT f.id, f.name, f.owner_id, f.invite_code,
         u.email AS owner_email, u.clerk_id AS owner_clerk_id, u.family_id AS owner_family_id
  FROM families f
  JOIN users u ON f.owner_id = u.id
  ORDER BY f.id
`;

console.log('USERS:');
console.log(JSON.stringify(users, null, 2));
console.log('\nFAMILIES:');
console.log(JSON.stringify(families, null, 2));

await sql.end();
