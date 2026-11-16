import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../../lib/server/session';
import { setUserTwoFactor, verifyPassword } from '../../../../lib/server/userStore';
import { buildOtpAuthUri, generateTotpSecret, verifyTotpToken } from '../../../../lib/server/cryptoUtil';
import { addSystemLog, getClientIp } from '../../../../lib/server/systemLogStore';

// GET /api/auth/2fa - Check status or generate a new setup secret
export async function GET(request: Request) {
  const { session, user } = getSessionUser(request);
  if (!session || !user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const secret = generateTotpSecret();
  const otpAuthUri = buildOtpAuthUri(user.username, secret, process.env.APP_TITLE || 'DockWatch');

  return NextResponse.json({
    enabled: !!user.twoFactorEnabled,
    pendingSecret: secret,
    otpAuthUri,
  });
}

// POST /api/auth/2fa - Enable or disable TOTP 2FA (requires current password confirmation)
export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const { session, user } = getSessionUser(request);
  if (!session || !user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, currentPassword, secret, totpCode } = body;

    if (!currentPassword || !verifyPassword(currentPassword, user.passwordHash, user.salt)) {
      addSystemLog({
        clientIp,
        user: user.username,
        userRealName: user.name,
        category: 'ACCESS_DENIED',
        level: 'WARN',
        action: '2FA_PASSWORD_VERIFY_FAILED',
        detail: `2FA 설정 변경 시 현재 비밀번호 확인 실패 (사용자: ${user.username}, IP: ${clientIp})`,
      });
      return NextResponse.json({ error: '현재 비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }

    if (action === 'enable') {
      if (!secret || !totpCode) {
        return NextResponse.json({ error: 'OTP 시크릿과 6자리 인증 코드를 입력해 주세요.' }, { status: 400 });
      }
      if (!verifyTotpToken(secret, String(totpCode))) {
        return NextResponse.json({ error: '입력하신 6자리 OTP 코드가 일치하지 않습니다.' }, { status: 400 });
      }
      setUserTwoFactor(user.id, true, secret);
      addSystemLog({
        clientIp,
        user: user.username,
        userRealName: user.name,
        category: 'USER_MGMT',
        level: 'INFO',
        action: '2FA_ENABLED',
        detail: `사용자 '${user.username}' 2단계 인증(TOTP OTP) 활성화 완료 (IP: ${clientIp})`,
      });
      return NextResponse.json({ success: true, enabled: true, message: '2단계 인증(OTP)이 활성화되었습니다.' });
    }

    if (action === 'disable') {
      setUserTwoFactor(user.id, false);
      addSystemLog({
        clientIp,
        user: user.username,
        userRealName: user.name,
        category: 'USER_MGMT',
        level: 'WARN',
        action: '2FA_DISABLED',
        detail: `사용자 '${user.username}' 2단계 인증(TOTP OTP) 비활성화 (IP: ${clientIp})`,
      });
      return NextResponse.json({ success: true, enabled: false, message: '2단계 인증(OTP)이 비활성화되었습니다.' });
    }

    return NextResponse.json({ error: '지원되지 않는 작업입니다.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '2FA 설정 중 오류 발생' }, { status: 500 });
  }
}
