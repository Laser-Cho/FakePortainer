import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../../lib/server/session';
import { markReauthVerified, verifyPassword } from '../../../../lib/server/userStore';
import { addSystemLog, getClientIp } from '../../../../lib/server/systemLogStore';

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const { session, user } = getSessionUser(request);

  if (!session || !user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { password } = body;
    if (!password) {
      return NextResponse.json({ error: '현재 비밀번호를 입력해 주세요.' }, { status: 400 });
    }

    const valid = verifyPassword(password, user.passwordHash, user.salt);
    if (!valid) {
      addSystemLog({
        clientIp,
        user: user.username,
        userRealName: user.name,
        category: 'ACCESS_DENIED',
        level: 'WARN',
        action: 'REAUTH_FAILED',
        detail: `중요 기능 접근 비밀번호 재확인 실패 (사용자: ${user.username}, IP: ${clientIp})`,
      });
      return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }

    markReauthVerified(user.id);
    addSystemLog({
      clientIp,
      user: user.username,
      userRealName: user.name,
      category: 'EVENT',
      level: 'INFO',
      action: 'REAUTH_SUCCESS',
      detail: `중요 기능 접근을 위한 비밀번호 재확인 완료 (사용자: ${user.username}, IP: ${clientIp})`,
    });

    return NextResponse.json({ success: true, validMinutes: 5 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '재확인 실패' }, { status: 500 });
  }
}
