import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../../lib/server/session';

export async function POST(request: Request) {
  const { session, user, errorReason, idleRemainingSeconds } = getSessionUser(request, {
    isBackgroundPoll: false,
  });

  if (!session || !user) {
    return NextResponse.json(
      {
        authenticated: false,
        errorReason,
        idleTimedOut: errorReason === 'IDLE_TIMEOUT',
        concurrentSessionBlocked: errorReason === 'CONCURRENT_SESSION',
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    idleRemainingSeconds,
  });
}
