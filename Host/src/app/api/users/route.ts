import { NextResponse } from 'next/server';
import {
  getUserProfiles,
  updateUserRole,
  unlockUser,
  deleteUser,
  findUserById,
} from '../../../lib/server/userStore';
import { getSessionUser } from '../../../lib/server/session';
import { addSystemLog, getClientIp } from '../../../lib/server/systemLogStore';

// GET /api/users - List all users (admin only)
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

  const users = getUserProfiles();
  return NextResponse.json({ users }, { headers: { 'Cache-Control': 'no-store' } });
}

// PATCH /api/users - Update role or unlock account
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
    const { userId, action, role } = body;

    const targetUser = findUserById(userId);
    if (!targetUser) {
      return NextResponse.json({ error: '대상 사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (action === 'update_role' && role) {
      const prevRole = targetUser.role;
      const res = updateUserRole(userId, role);
      if (!res.success) return NextResponse.json({ error: res.error }, { status: 400 });

      addSystemLog({
        clientIp,
        user: operator.username,
        userRealName: operator.name,
        category: 'ROLE_CHANGE',
        level: 'INFO',
        action: 'USER_ROLE_CHANGED',
        detail: `관리자 '${operator.username}'에 의해 사용자 '${targetUser.username}'(${targetUser.name})의 권한이 [${prevRole}]에서 [${role}]로 변경되었습니다. (IP: ${clientIp})`,
      });

      return NextResponse.json({ success: true, message: `권한이 ${role}(으)로 변경되었습니다.` });
    }

    if (action === 'unlock') {
      const res = unlockUser(userId);
      if (!res.success) return NextResponse.json({ error: res.error }, { status: 400 });

      addSystemLog({
        clientIp,
        user: operator.username,
        userRealName: operator.name,
        category: 'USER_MGMT',
        level: 'INFO',
        action: 'USER_ACCOUNT_UNLOCKED',
        detail: `관리자 '${operator.username}'에 의해 잠긴 사용자 계정 '${targetUser.username}'(${targetUser.name})이 잠금 해제되었습니다. (IP: ${clientIp})`,
      });

      return NextResponse.json({ success: true, message: '계정 잠금이 해제되었습니다.' });
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
