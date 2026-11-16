import { NextResponse } from 'next/server';
import {
  getUserProfiles,
  updateUserRole,
  unlockUser,
  deleteUser,
  findUserById,
  isReauthRecentlyVerified,
  verifyPassword,
  updateUserAllowedIps,
  setUserTwoFactor,
  markReauthVerified,
} from '../../../lib/server/userStore';
import { getSessionUser } from '../../../lib/server/session';
import { addSystemLog, getClientIp } from '../../../lib/server/systemLogStore';

// GET /api/users - List all users (admin only + recent password re-verification)
export async function GET(request: Request) {
  const clientIp = getClientIp(request);
  const { session, user } = getSessionUser(request);

  if (!session || !user) {
    addSystemLog({
      clientIp,
      user: 'anonymous',
      category: 'ACCESS_DENIED',
      level: 'WARN',
      action: 'UNAUTHORIZED_ACCESS',
      detail: `미인증 상태에서 사용자 목록 조회 시도 (IP: ${clientIp})`,
    });
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  if (user.role !== 'admin') {
    addSystemLog({
      clientIp,
      user: user.username,
      userRealName: user.name,
      category: 'ACCESS_DENIED',
      level: 'ERROR',
      action: 'ADMIN_ACCESS_DENIED',
      detail: `일반 사용자 '${user.username}' (${user.name})가 관리자 전용 사용자 목록 조회 시도 (IP: ${clientIp})`,
    });
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  if (!isReauthRecentlyVerified(user)) {
    return NextResponse.json(
      { error: '사용자 계정 정보 조회를 위해 비밀번호 재확인이 필요합니다.', requireReauth: true },
      { status: 403 }
    );
  }

  const users = getUserProfiles();
  return NextResponse.json({ users }, { headers: { 'Cache-Control': 'no-store' } });
}

// PATCH /api/users - Update role, unlock/reset password, update allowed IPs, or reset 2FA
export async function PATCH(request: Request) {
  const clientIp = getClientIp(request);
  const { session, user: operator } = getSessionUser(request);

  if (!session || !operator) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  if (operator.role !== 'admin') {
    addSystemLog({
      clientIp,
      user: operator.username,
      userRealName: operator.name,
      category: 'ACCESS_DENIED',
      level: 'ERROR',
      action: 'ADMIN_PRIVILEGE_ATTEMPT',
      detail: `일반 사용자 '${operator.username}'가 사용자 권한/잠금 수정 API 호출 시도 (차단됨, IP: ${clientIp})`,
    });
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { userId, action, role, tempPassword, allowedIps, approvalNote, confirmPassword } = body;

    if (!isReauthRecentlyVerified(operator)) {
      if (!confirmPassword || !verifyPassword(confirmPassword, operator.passwordHash, operator.salt)) {
        return NextResponse.json(
          { error: '권한/계정 변경을 위해 관리자 비밀번호 재확인이 필요합니다.', requireReauth: true },
          { status: 403 }
        );
      }
      markReauthVerified(operator.id);
    }

    const targetUser = findUserById(userId);
    if (!targetUser) {
      return NextResponse.json({ error: '대상 사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (action === 'update_role' && role) {
      if (!['admin', 'user', 'monitor'].includes(role)) {
        return NextResponse.json({ error: '유효하지 않은 역할입니다.' }, { status: 400 });
      }
      const prevRole = targetUser.role;
      const res = updateUserRole(userId, role);
      if (!res.success) return NextResponse.json({ error: res.error }, { status: 400 });

      const noteStr = approvalNote ? ` [승인/변경사유: ${String(approvalNote).trim()}]` : '';
      addSystemLog({
        clientIp,
        user: operator.username,
        userRealName: operator.name,
        category: 'ROLE_CHANGE',
        level: 'WARN',
        action: 'USER_ROLE_CHANGED',
        detail: `관리자 '${operator.username}'에 의해 사용자 '${targetUser.username}'(${targetUser.name})의 권한이 [${prevRole}]에서 [${role}]로 변경되었습니다.${noteStr} (IP: ${clientIp})`,
      });

      return NextResponse.json({ success: true, message: `권한이 ${role}(으)로 변경되었습니다.` });
    }

    if (action === 'unlock') {
      const res = unlockUser(userId, tempPassword);
      if (!res.success) return NextResponse.json({ error: res.error }, { status: 400 });

      addSystemLog({
        clientIp,
        user: operator.username,
        userRealName: operator.name,
        category: 'USER_MGMT',
        level: 'INFO',
        action: tempPassword ? 'USER_UNLOCKED_PASSWORD_RESET' : 'USER_ACCOUNT_UNLOCKED',
        detail: `관리자 '${operator.username}'에 의해 잠긴 사용자 계정 '${targetUser.username}'(${targetUser.name})이 잠금 해제${
          tempPassword ? ' 및 임시 비밀번호 초기화(다음 로그인 시 재설정 필수)' : ''
        } 되었습니다. (IP: ${clientIp})`,
      });

      return NextResponse.json({
        success: true,
        message: tempPassword
          ? '계정 잠금이 해제되고 임시 비밀번호로 초기화되었습니다.'
          : '계정 잠금이 해제되었습니다.',
      });
    }

    if (action === 'update_allowed_ips') {
      const ipList = Array.isArray(allowedIps)
        ? allowedIps
        : String(allowedIps || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
      const res = updateUserAllowedIps(userId, ipList);
      if (!res.success) return NextResponse.json({ error: res.error }, { status: 400 });

      addSystemLog({
        clientIp,
        user: operator.username,
        userRealName: operator.name,
        category: 'USER_MGMT',
        level: 'INFO',
        action: 'USER_ALLOWED_IPS_UPDATED',
        detail: `관리자 '${operator.username}'가 '${targetUser.username}'의 접속 허용 IP를 [${
          ipList.length > 0 ? ipList.join(', ') : '제한 없음'
        }](으)로 설정했습니다. (IP: ${clientIp})`,
      });

      return NextResponse.json({ success: true, message: '접속 허용 IP 설정이 저장되었습니다.' });
    }

    if (action === 'reset_2fa') {
      const res = setUserTwoFactor(userId, false);
      if (!res.success) return NextResponse.json({ error: res.error }, { status: 400 });

      addSystemLog({
        clientIp,
        user: operator.username,
        userRealName: operator.name,
        category: 'USER_MGMT',
        level: 'WARN',
        action: 'USER_2FA_RESET',
        detail: `관리자 '${operator.username}'에 의해 '${targetUser.username}'의 2단계 인증(OTP)이 초기화되었습니다. (IP: ${clientIp})`,
      });

      return NextResponse.json({ success: true, message: '2단계 인증이 초기화되었습니다.' });
    }

    return NextResponse.json({ error: '지원되지 않는 작업입니다.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '요청 처리 실패' }, { status: 500 });
  }
}

// DELETE /api/users - Delete user
export async function DELETE(request: Request) {
  const clientIp = getClientIp(request);
  const { session, user: operator } = getSessionUser(request);

  if (!session || !operator) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  if (operator.role !== 'admin') {
    addSystemLog({
      clientIp,
      user: operator.username,
      userRealName: operator.name,
      category: 'ACCESS_DENIED',
      level: 'ERROR',
      action: 'ADMIN_DELETE_ATTEMPT',
      detail: `일반 사용자 '${operator.username}'가 사용자 삭제 시도 (차단됨, IP: ${clientIp})`,
    });
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  if (!isReauthRecentlyVerified(operator)) {
    return NextResponse.json(
      { error: '계정 삭제를 위해 비밀번호 재확인이 필요합니다.', requireReauth: true },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const targetUser = findUserById(userId);
    if (!targetUser) {
      return NextResponse.json({ error: '대상 사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    const res = deleteUser(userId);
    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    addSystemLog({
      clientIp,
      user: operator.username,
      userRealName: operator.name,
      category: 'USER_MGMT',
      level: 'WARN',
      action: 'USER_DELETED',
      detail: `관리자 '${operator.username}'에 의해 사용자 계정 '${targetUser.username}' (실명: ${targetUser.name}, 이메일: ${targetUser.email})이 영구 삭제되었습니다. (IP: ${clientIp})`,
    });

    return NextResponse.json({ success: true, message: '사용자가 삭제되었습니다.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '사용자 삭제 실패' }, { status: 500 });
  }
}
