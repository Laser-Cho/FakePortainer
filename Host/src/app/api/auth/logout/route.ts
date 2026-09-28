import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../../lib/server/session';
import { addSystemLog, getClientIp } from '../../../../lib/server/systemLogStore';

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const { user } = getSessionUser(request);

  if (user) {
    addSystemLog({
      clientIp,
      user: user.username,
      userRealName: user.name,
      category: 'EVENT',
      level: 'INFO',
      action: 'USER_LOGOUT',
      detail: `사용자 '${user.username}' (${user.name}) 로그아웃 (IP: ${clientIp})`,
    });
  }

  const response = NextResponse.json({ success: true, message: 'Logged out' });
  response.cookies.set('fakeportainer_session', '', {
    httpOnly: false,
    path: '/',
    maxAge: 0,
  });

  return response;
}
