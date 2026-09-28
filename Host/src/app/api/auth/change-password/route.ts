import { NextResponse } from 'next/server';
import {
  findUserByUsername,
  verifyPassword,
  updateUserPassword,
  validatePasswordComplexity,
} from '../../../../lib/server/userStore';
import { getSessionUser } from '../../../../lib/server/session';
import { addSystemLog, getClientIp } from '../../../../lib/server/systemLogStore';

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  try {
    const body = await request.json();
    const { username, currentPassword, newPassword } = body;

    // Identify target user: from session or from request body
    const { user: sessionUser } = getSessionUser(request);
    const targetUsername = username ? username.trim() : (sessionUser ? sessionUser.username : '');

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

    // Verify current password
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

    // Validate new password complexity
    const complexity = validatePasswordComplexity(newPassword);
    if (!complexity.valid) {
      return NextResponse.json({ error: complexity.reason }, { status: 400 });
    }

    if (currentPassword === newPassword) {
      return NextResponse.json({ error: '새 비밀번호는 현재 비밀번호와 달라야 합니다.' }, { status: 400 });
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
