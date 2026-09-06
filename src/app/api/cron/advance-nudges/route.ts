import { NextResponse } from 'next/server';
import { runAdvanceNudges } from '@/features/notifications/run-advance-nudges';

export const runtime = 'nodejs';
/** Cron can touch every family — allow a longer serverless window. */
export const maxDuration = 60;

/**
 * Vercel Cron (and manual ops) entrypoint for 7/3/1-day advance nudges.
 * Auth: `Authorization: Bearer ${CRON_SECRET}` (Vercel injects this for crons).
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'cron_not_configured' }, { status: 503 });
  }

  const header = request.headers.get('authorization');
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await runAdvanceNudges();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron/advance-nudges]', error);
    return NextResponse.json({ error: 'nudge_run_failed' }, { status: 500 });
  }
}
