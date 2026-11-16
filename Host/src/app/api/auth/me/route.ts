import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../../lib/server/session';
import { isPasswordExpired, isReauthRecentlyVerified } from '../../../../lib/server/userStore';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const isBgPoll = request.headers.get('x-background-poll') === 'true';
  const { session, user, errorReason, idleRemainingSeconds } = getSessionUser(request, {
    isBackgroundPoll: isBgPoll,
    allowExpiredPassword: true,
  });

  if (!session || !user) {
    const res = NextResponse.json(
      {
        authenticated: false,
        errorReason,
        idleTimedOut: errorReason === 'IDLE_TIMEOUT',
        concurrentSessionBlocked: errorReason === 'CONCURRENT_SESSION',
      },
      { status: 401 }
    );
    if (errorReason === 'IDLE_TIMEOUT' || errorReason === 'CONCURRENT_SESSION' || errorReason === 'LOCKED') {
      res.cookies.set('fakeportainer_session', '', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.COOKIE_SECURE === 'true',
        path: '/',
        maxAge: 0,
      });
    }
    return res;
  }

  const requirePasswordChange = isPasswordExpired(user.passwordChangedAt) || !!user.mustChangePassword;

  return NextResponse.json(
    {
      authenticated: true,
      idleRemainingSeconds,
      reauthValid: isReauthRecentlyVerified(user),
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        requirePasswordChange,
        twoFactorEnabled: !!user.twoFactorEnabled,
        createdAt: user.createdAt,
        passwordChangedAt: user.passwordChangedAt,
        lastLoginAt: user.lastLoginAt,
        lastLoginIp: user.lastLoginIp,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
