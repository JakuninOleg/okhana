import { NextResponse } from 'next/server';
import { runDailyBriefings } from '@/features/notifications/run-daily-briefings';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Evening digest (15:00 UTC ≈ 18:00 MSK).
 * Auth: `Authorization: Bearer ${CRON_SECRET}`.
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
    const briefing = await runDailyBriefings({ slot: 'evening' });
    return NextResponse.json({ ok: true, briefing });
  } catch (error) {
    console.error('[cron/daily-briefing]', error);
    return NextResponse.json({ error: 'briefing_failed' }, { status: 500 });
  }
}
