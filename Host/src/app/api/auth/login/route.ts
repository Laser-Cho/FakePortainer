import crypto from 'crypto';
import { NextResponse } from 'next/server';
import {
  findUserByUsername,
  recordLoginAttempt,
  verifyPassword,
  isPasswordExpired,
  setUserActiveSession,
} from '../../../../lib/server/userStore';
import { createSessionToken, getGlobalAllowedIps } from '../../../../lib/server/session';
import { addSystemLog, getClientIp, readSystemLogs } from '../../../../lib/server/systemLogStore';
import { isIpAllowed, verifyTotpToken } from '../../../../lib/server/cryptoUtil';
import { checkRateLimit } from '../../../../lib/server/rateLimit';

function clearAuthCookie(response: NextResponse) {
  response.cookies.set('fakeportainer_session', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: 0,
  });
}

async function notifyAdminLoginWebhook(payload: Record<string, unknown>) {
  const webhookUrl = process.env.ADMIN_ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn('[Admin Alert Webhook] Failed to dispatch notification');
  }
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request);

  // Rate limiting against brute-force attacks (max 20 attempts per 5 min per IP)
  const rl = checkRateLimit(`login:${clientIp}`, 20, 5 * 60 * 1000);
  if (!rl.allowed) {
    addSystemLog({
      clientIp,
      user: 'anonymous',
      category: 'ACCESS_DENIED',
      level: 'WARN',
      action: 'LOGIN_RATE_LIMITED',
      detail: `과도한 로그인 시도로 요청 일시 차단 (IP: ${clientIp}, 재시도 대기: ${rl.retryAfterSec}초)`,
    });
    return NextResponse.json(
      { error: `로그인 시도가 너무 많습니다. ${rl.retryAfterSec}초 후 다시 시도해 주세요.` },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { username, password, totpCode } = body;

    if (!username || !password) {
      return NextResponse.json({ error: '아이디와 비밀번호를 입력해 주세요.' }, { status: 400 });
    }

    const cleanUsername = username.trim();
    const user = findUserByUsername(cleanUsername);

    // Check Global IP Whitelist
    const globalAllowed = getGlobalAllowedIps();
    if (globalAllowed.length > 0 && !isIpAllowed(clientIp, globalAllowed)) {
      addSystemLog({
        clientIp,
        user: cleanUsername,
        category: 'ACCESS_DENIED',
        level: 'ERROR',
        action: 'GLOBAL_IP_DENIED',
        detail: `허용된 접속 IP 대역이 아닌 위치에서 로그인 시도 차단: '${cleanUsername}' (IP: ${clientIp})`,
      });
      return NextResponse.json({ error: '허용된 접속 IP 주소가 아닙니다.' }, { status: 403 });
    }

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

    // Check per-user IP Whitelist
    if (user.allowedIps && user.allowedIps.length > 0 && !isIpAllowed(clientIp, user.allowedIps)) {
      addSystemLog({
        clientIp,
        user: user.username,
        userRealName: user.name,
        category: 'ACCESS_DENIED',
        level: 'ERROR',
        action: 'USER_IP_WHITELIST_DENIED',
        detail: `사용자 '${user.username}'의 허용 IP 목록(${user.allowedIps.join(', ')}) 외 접속 시도 차단 (IP: ${clientIp})`,
      });
      return NextResponse.json({ error: '이 계정에 허용된 IP 주소에서만 로그인할 수 있습니다.' }, { status: 403 });
    }

    // Check if account is locked (5 consecutive failures or 90-day inactivity)
    if (user.isLocked) {
      addSystemLog({
        clientIp,
        user: user.username,
        userRealName: user.name,
        category: 'ACCESS_DENIED',
        level: 'ERROR',
        action: 'LOCKED_ACCOUNT_ATTEMPT',
        detail: `잠긴 계정(${user.username}, 사유: ${user.lockReason || 'LOCKED'})에 대한 로그인 시도 차단 (IP: ${clientIp})`,
      });
      const res = NextResponse.json(
        {
          error:
            user.lockReason?.startsWith('INACTIVE')
              ? '장기 미접속(90일 이상)으로 계정이 잠겼습니다. 관리자에게 잠금 해제를 요청하십시오.'
              : '비밀번호 5회 연속 실패로 계정이 잠겼습니다. 관리자에게 잠금 해제 및 비밀번호 초기화를 요청하십시오.',
          isLocked: true,
        },
        { status: 403 }
      );
      clearAuthCookie(res);
      return res;
    }

    const isMatch = verifyPassword(password, user.passwordHash, user.salt);

    if (!isMatch) {
      const attemptResult = recordLoginAttempt(user.username, false, clientIp);
      const currentFailCount = attemptResult.user?.failedLoginAttempts || 1;
      const remainingAttempts = Math.max(0, 5 - currentFailCount);

      if (attemptResult.lockedNow) {
        addSystemLog({
          clientIp,
          user: user.username,
          userRealName: user.name,
          category: 'LOGIN_FAILURE',
          level: 'ERROR',
          action: 'ACCOUNT_LOCKED',
          detail: `사용자 '${user.username}' 비밀번호 5회 연속 실패로 계정이 잠금 처리되고 세션이 종료되었습니다. (IP: ${clientIp})`,
        });
        const res = NextResponse.json(
          {
            error: '비밀번호 5회 연속 실패로 계정이 잠겼습니다. 세션이 종료됩니다. 관리자에게 문의하십시오.',
            isLocked: true,
          },
          { status: 403 }
        );
        clearAuthCookie(res);
        return res;
      }

      addSystemLog({
        clientIp,
        user: user.username,
        userRealName: user.name,
        category: 'LOGIN_FAILURE',
        level: 'WARN',
        action: 'LOGIN_FAILED',
        detail: `사용자 '${user.username}' 비밀번호 불일치 (실패 횟수: ${currentFailCount}/5, IP: ${clientIp})`,
      });

      return NextResponse.json(
        {
          error: `비밀번호가 올바르지 않습니다. (연속 ${remainingAttempts}회 더 실패 시 계정이 잠깁니다.)`,
          remainingAttempts,
        },
        { status: 401 }
      );
    }

    // 2-Factor Authentication (TOTP) verification if enabled
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!totpCode) {
        return NextResponse.json({
          requiresTwoFactor: true,
          message: '2단계 인증(OTP) 6자리 코드를 입력해 주세요.',
        });
      }

      const otpValid = verifyTotpToken(user.twoFactorSecret, String(totpCode));
      if (!otpValid) {
        const attemptResult = recordLoginAttempt(user.username, false, clientIp);
        const currentFailCount = attemptResult.user?.failedLoginAttempts || 1;
        addSystemLog({
          clientIp,
          user: user.username,
          userRealName: user.name,
          category: 'LOGIN_FAILURE',
          level: 'WARN',
          action: '2FA_OTP_FAILED',
          detail: `사용자 '${user.username}' 2단계 인증(OTP) 코드 불일치 (실패 횟수: ${currentFailCount}/5, IP: ${clientIp})`,
        });
        if (attemptResult.lockedNow) {
          const res = NextResponse.json(
            {
              error: '인증 5회 연속 실패로 계정이 잠겼습니다.',
              isLocked: true,
            },
            { status: 403 }
          );
          clearAuthCookie(res);
          return res;
        }
        return NextResponse.json(
          {
            requiresTwoFactor: true,
            error: '2단계 인증(OTP) 코드가 올바르지 않습니다.',
          },
          { status: 401 }
        );
      }
    }

    const prevLoginAt = user.lastLoginAt;
    const prevLoginIp = user.lastLoginIp;
    const requirePasswordChange = isPasswordExpired(user.passwordChangedAt) || !!user.mustChangePassword;

    if (requirePasswordChange) {
      addSystemLog({
        clientIp,
        user: user.username,
        userRealName: user.name,
        category: 'EVENT',
        level: 'WARN',
        action: 'PASSWORD_EXPIRED_PROMPT',
        detail: `사용자 '${user.username}' 비밀번호 유효기간(90일) 만료 또는 초기화 상태로 재설정 요구됨 (IP: ${clientIp})`,
      });
      return NextResponse.json({
        success: true,
        requirePasswordChange: true,
        username: user.username,
        name: user.name,
        role: user.role,
      });
    }

    // Success: issue unique single active session (concurrent session control)
    const sessionId = crypto.randomUUID();
    const { hadActiveSession, previousIp } = setUserActiveSession(user.id, sessionId, clientIp);
    recordLoginAttempt(user.username, true, clientIp);

    if (hadActiveSession) {
      addSystemLog({
        clientIp,
        user: user.username,
        userRealName: user.name,
        category: 'SECURITY_ALERT',
        level: 'WARN',
        action: 'CONCURRENT_SESSION_TERMINATED',
        detail: `동시 접속 제한 정책: '${user.username}'의 기존 세션(IP: ${previousIp || 'unknown'})이 신규 로그인(IP: ${clientIp})으로 종료되었습니다.`,
      });
    }

    const sessionToken = createSessionToken(user, sessionId);

    addSystemLog({
      clientIp,
      user: user.username,
      userRealName: user.name,
      category: 'LOGIN_SUCCESS',
      level: 'INFO',
      action: 'USER_LOGIN',
      detail: `사용자 '${user.username}' (${user.name}, 역할: ${user.role}) 로그인 성공 (IP: ${clientIp})`,
    });

    let adminAlertInfo: Record<string, unknown> | undefined;
    if (user.role === 'admin') {
      const recentLogs = readSystemLogs().slice(0, 200);
      const recentFailedSinceLast = recentLogs.filter(
        (l) =>
          l.category === 'LOGIN_FAILURE' &&
          (!prevLoginAt || new Date(l.timestamp).getTime() > new Date(prevLoginAt).getTime())
      ).length;

      addSystemLog({
        clientIp,
        user: user.username,
        userRealName: user.name,
        category: 'SECURITY_ALERT',
        level: 'WARN',
        action: 'ADMIN_LOGIN_ALERT',
        detail: `[관리자 로그인 알림] 관리자 '${user.username}'(${user.name}) 접속 완료 (접속 IP: ${clientIp}, 이전 접속: ${prevLoginIp || '최초'} / ${prevLoginAt || '-'})`,
      });

      void notifyAdminLoginWebhook({
        event: 'ADMIN_LOGIN_ALERT',
        username: user.username,
        name: user.name,
        clientIp,
        timestamp: new Date().toISOString(),
        previousLoginIp: prevLoginIp,
        previousLoginAt: prevLoginAt,
      });

      adminAlertInfo = {
        message: `관리자 계정('${user.username}') 접속 알림이 보안 감사 로그에 기록되었습니다.`,
        currentIp: clientIp,
        previousLoginIp: prevLoginIp || null,
        previousLoginAt: prevLoginAt || null,
        recentFailedAttempts: recentFailedSinceLast,
        concurrentSessionTerminated: hadActiveSession,
      };
    }

    const response = NextResponse.json({
      success: true,
      authenticated: true,
      username: user.username,
      name: user.name,
      role: user.role,
      requirePasswordChange: false,
      twoFactorEnabled: !!user.twoFactorEnabled,
      concurrentSessionTerminated: hadActiveSession,
      adminAlertInfo,
    });

    response.cookies.set('fakeportainer_session', sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Login failed' }, { status: 500 });
  }
}
