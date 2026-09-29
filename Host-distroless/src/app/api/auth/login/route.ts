import { NextResponse } from 'next/server';
import {
  findUserByUsername,
  recordLoginAttempt,
  verifyPassword,
  isPasswordExpired,
} from '../../../../lib/server/userStore';
import { createSessionToken } from '../../../../lib/server/session';
import { addSystemLog, getClientIp } from '../../../../lib/server/systemLogStore';

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: '아이디와 비밀번호를 입력해 주세요.' }, { status: 400 });
    }

    const cleanUsername = username.trim();
    const user = findUserByUsername(cleanUsername);

    if (!user) {
      addSystemLog({
        clientIp,
        user: cleanUsername,
        category: 'LOGIN_FAILURE',
        level: 'WARN',
        action: 'LOGIN_FAILED',
        detail: `존재하지 않는 사용자 계정으로 로그인 시도: '${cleanUsername}' (IP: ${clientIp})`,
      });
      return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    // Check if account is locked (5 consecutive failures)
    if (user.isLocked) {
      addSystemLog({
        clientIp,
        user: user.username,
        userRealName: user.name,
        category: 'ACCESS_DENIED',
        level: 'ERROR',
        action: 'LOCKED_ACCOUNT_ATTEMPT',
        detail: `잠긴 계정(${user.username}, 실명: ${user.name})에 대한 로그인 시도 차단 (IP: ${clientIp})`,
      });
      return NextResponse.json(
        {
          error: '비밀번호 5회 연속 실패로 계정이 잠겼습니다. 관리자에게 문의하거나 비밀번호를 재설정하십시오.',
          isLocked: true,
        },
        { status: 403 }
      );
    }

    const isMatch = verifyPassword(password, user.passwordHash, user.salt);

    if (!isMatch) {
      const attemptResult = recordLoginAttempt(user.username, false, clientIp);
      const remainingAttempts = Math.max(0, 5 - (user.failedLoginAttempts || 0));

      if (attemptResult.lockedNow) {
        addSystemLog({
          clientIp,
          user: user.username,
          userRealName: user.name,
          category: 'LOGIN_FAILURE',
          level: 'ERROR',
          action: 'ACCOUNT_LOCKED',
          detail: `사용자 '${user.username}' 비밀번호 5회 연속 실패로 계정이 잠금 처리되었습니다. (IP: ${clientIp})`,
        });
        return NextResponse.json(
          {
            error: '비밀번호 5회 연속 실패로 계정이 잠겼습니다. 세션이 종료됩니다. 관리자에게 문의하십시오.',
            isLocked: true,
          },
          { status: 403 }
        );
      }

      addSystemLog({
        clientIp,
        user: user.username,
        userRealName: user.name,
        category: 'LOGIN_FAILURE',
        level: 'WARN',
        action: 'LOGIN_FAILED',
        detail: `사용자 '${user.username}' 비밀번호 불일치 (실패 횟수: ${user.failedLoginAttempts}/5, IP: ${clientIp})`,
      });

      return NextResponse.json(
        {
          error: `비밀번호가 올바르지 않습니다. (연속 ${remainingAttempts}회 더 실패 시 계정이 잠깁니다.)`,
          remainingAttempts,
        },
        { status: 401 }
      );
    }

    // Success
    recordLoginAttempt(user.username, true, clientIp);
    const requirePasswordChange = isPasswordExpired(user.passwordChangedAt);

    const sessionToken = createSessionToken(user);

    addSystemLog({
      clientIp,
      user: user.username,
      userRealName: user.name,
      category: 'LOGIN_SUCCESS',
      level: 'INFO',
      action: 'USER_LOGIN',
      detail: `사용자 '${user.username}' (${user.name}, 역할: ${user.role}) 로그인 성공 (IP: ${clientIp})${
        requirePasswordChange ? ' [비밀번호 90일 만료 재설정 필요]' : ''
      }`,
    });

    const response = NextResponse.json({
      success: true,
      token: sessionToken,
      username: user.username,
      name: user.name,
      role: user.role,
      requirePasswordChange,
    });

    response.cookies.set('fakeportainer_session', sessionToken, {
      httpOnly: false,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Login failed' }, { status: 500 });
  }
}
