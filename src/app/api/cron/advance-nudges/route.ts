import { NextResponse } from 'next/server';
import { runAdvanceNudges } from '@/features/notifications/run-advance-nudges';
import { runDailyBriefings } from '@/features/notifications/run-daily-briefings';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorizeCron(request: Request): Response | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'cron_not_configured' }, { status: 503 });
  }
  const header = request.headers.get('authorization');
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}

/**
 * Morning job (06:00 UTC ≈ 09:00 MSK): advance 7/3/1 nudges + morning briefing.
 * Auth: `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(request: Request): Promise<Response> {
  const denied = authorizeCron(request);
  if (denied) {
    return denied;
  }

  try {
    const [nudges, briefing] = await Promise.all([
      runAdvanceNudges(),
      runDailyBriefings({ slot: 'morning' }),
    ]);
    return NextResponse.json({ ok: true, nudges, briefing });
  } catch (error) {
    console.error('[cron/advance-nudges]', error);
    return NextResponse.json({ error: 'morning_jobs_failed' }, { status: 500 });
  }
}
