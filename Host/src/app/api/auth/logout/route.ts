import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../../lib/server/session';
import { addSystemLog, getClientIp } from '../../../../lib/server/systemLogStore';
import { clearUserActiveSession } from '../../../../lib/server/userStore';

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  let reason = 'manual';
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.reason) reason = String(body.reason);
  } catch {}

  const { session, user } = getSessionUser(request, { allowExpiredPassword: true });

  if (user) {
    clearUserActiveSession(user.id, session?.sessionId);
    addSystemLog({
      clientIp,
      user: user.username,
      userRealName: user.name,
      category: 'EVENT',
      level: 'INFO',
      action: reason === 'idle_timeout' ? 'SESSION_IDLE_TIMEOUT' : 'USER_LOGOUT',
      detail:
        reason === 'idle_timeout'
          ? `사용자 '${user.username}' (${user.name}) 10분 이상 미활동으로 자동 로그아웃 (IP: ${clientIp})`
          : `사용자 '${user.username}' (${user.name}) 로그아웃 (IP: ${clientIp})`,
    });
  }

  const response = NextResponse.json({ success: true, message: 'Logged out' });
  response.cookies.set('fakeportainer_session', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: 0,
  });

  return response;
}
