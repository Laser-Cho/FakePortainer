import { NextResponse } from 'next/server';
import {
  findUserByUsername,
  verifyPassword,
  updateUserPassword,
  validatePasswordComplexity,
} from '../../../../lib/server/userStore';
import { getSessionUser } from '../../../../lib/server/session';
import { addSystemLog, getClientIp } from '../../../../lib/server/systemLogStore';
import { checkRateLimit } from '../../../../lib/server/rateLimit';

export async function POST(request: Request) {
  const clientIp = getClientIp(request);

  const rl = checkRateLimit(`chpw:${clientIp}`, 10, 5 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { username, currentPassword, newPassword } = body;

    const { user: sessionUser } = getSessionUser(request, { allowExpiredPassword: true });
    const targetUsername = sessionUser ? sessionUser.username : (username ? username.trim() : '');

    if (!targetUsername || !currentPassword || !newPassword) {
      return NextResponse.json(
        { error: '아이디, 현재 비밀번호, 새로운 비밀번호를 모두 입력해 주세요.' },
        { status: 400 }
      );
    }

    const user = findUserByUsername(targetUsername);
    if (!user) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (user.isLocked) {
      return NextResponse.json(
        { error: '잠긴 계정은 관리자의 잠금 해제 및 초기화 후 비밀번호를 변경할 수 있습니다.' },
        { status: 403 }
      );
    }

    // Verify current password (항목 10: 추가 본인 확인)
    const isMatch = verifyPassword(currentPassword, user.passwordHash, user.salt);
    if (!isMatch) {
      addSystemLog({
        clientIp,
        user: user.username,
        userRealName: user.name,
        category: 'LOGIN_FAILURE',
        level: 'WARN',
        action: 'PASSWORD_CHANGE_FAILED',
        detail: `비밀번호 변경 실패 - 현재 비밀번호 불일치 (사용자: ${user.username}, IP: ${clientIp})`,
      });
      return NextResponse.json({ error: '현재 비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }

    const complexity = validatePasswordComplexity(newPassword, user.username);
    if (!complexity.valid) {
      return NextResponse.json({ error: complexity.reason }, { status: 400 });
    }

    const updateResult = updateUserPassword(user.id, newPassword);
    if (!updateResult.success) {
      return NextResponse.json({ error: updateResult.error || '비밀번호 변경 실패' }, { status: 400 });
    }

    addSystemLog({
      clientIp,
      user: user.username,
      userRealName: user.name,
      category: 'USER_MGMT',
      level: 'INFO',
      action: 'PASSWORD_CHANGE',
      detail: `사용자 '${user.username}' (${user.name}) 비밀번호 변경 성공 - 90일 유효기간 갱신 완료 (IP: ${clientIp})`,
    });

    return NextResponse.json({
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다. (90일 유효기간 갱신)',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '비밀번호 변경 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
