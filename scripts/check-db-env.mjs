import { readFileSync } from 'node:fs';

/** Expected prod project — must match .cursor/mcp.json project_ref. */
export const OKHANA_PROD_PROJECT_REF = 'qmtcnmrjvnvurgxrskmh';

/** Legacy dev project (retired) — warn if still in .env.local. */
export const OKHANA_DEV_PROJECT_REF = 'ccfwpwndoyttjiqwnebp';

function parseDbUrl(raw) {
  const url = raw.trim().replace(/^["']|["']$/g, '');
  const u = new URL(url);
  const ref = u.username.replace('postgres.', '');
  const region = u.hostname.match(/aws-\d+-([^.]+)/)?.[1] ?? '?';
  return { host: u.hostname, port: u.port, region, ref };
}

function readMcpProjectRef() {
  try {
    const mcp = JSON.parse(readFileSync('.cursor/mcp.json', 'utf8'));
    const url = mcp.mcpServers?.supabase?.url ?? '';
    return new URL(url).searchParams.get('project_ref');
  } catch {
    return null;
  }
}

function readEnvFile(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

const content = readEnvFile('.env.local');
if (!content) {
  console.error('Missing .env.local — copy from .env.example');
  process.exit(1);
}

const mcpRef = readMcpProjectRef();
let hasError = false;

console.log('Supabase environment check\n');
if (mcpRef) {
  console.log(`MCP project_ref:     ${mcpRef}`);
}
console.log(`Expected prod ref:   ${OKHANA_PROD_PROJECT_REF}`);
console.log(`Legacy dev ref:      ${OKHANA_DEV_PROJECT_REF} (should not be used)\n`);

for (const line of content.split('\n')) {
  const m = line.match(/^(DATABASE_URL|DIRECT_URL|NEXT_PUBLIC_SUPABASE_URL)=(.+)$/);
  if (!m) continue;
  const key = m[1];
  const raw = m[2];

  if (key === 'NEXT_PUBLIC_SUPABASE_URL') {
    const v = raw.trim().replace(/^["']|["']$/g, '');
    try {
      const ref = new URL(v).hostname.split('.')[0];
      const ok = ref === OKHANA_PROD_PROJECT_REF;
      console.log(`${key}: ref=${ref} ${ok ? '✓ prod' : '✗ NOT prod'}`);
      if (!ok) hasError = true;
    } catch {
      console.log(`${key}: (invalid URL)`);
      hasError = true;
    }
    continue;
  }

  const { host, port, region, ref } = parseDbUrl(raw);
  let status = '✗ unknown';
  if (ref === OKHANA_PROD_PROJECT_REF) status = '✓ prod';
  else if (ref === OKHANA_DEV_PROJECT_REF) status = '✗ still DEV — update to prod';
  else status = '✗ unexpected ref';

  console.log(`${key}: host=${host} port=${port} region=${region} ref=${ref} ${status}`);
  if (ref !== OKHANA_PROD_PROJECT_REF) hasError = true;
}

if (mcpRef && mcpRef !== OKHANA_PROD_PROJECT_REF) {
  console.log(`\nWarning: MCP ref (${mcpRef}) does not match OKHANA_PROD_PROJECT_REF constant.`);
  hasError = true;
}

if (hasError) {
  console.log('\n→ Fix: Supabase Dashboard → okhana (prod) → Settings → Database');
  console.log('  Copy Transaction pooler (:6543) → DATABASE_URL');
  console.log('  Copy Session pooler (:5432)   → DIRECT_URL');
  console.log('  Project Settings → API → URL + anon/publishable → NEXT_PUBLIC_SUPABASE_*');
  process.exit(1);
}

console.log('\nAll Supabase env vars point at prod.');
