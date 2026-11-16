import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../lib/server/session';
import { getAllUsers, isReauthRecentlyVerified } from '../../../lib/server/userStore';
import { readSystemLogs, addSystemLog, getClientIp } from '../../../lib/server/systemLogStore';
import { readHistoryLogs } from '../../../lib/server/historyStore';
import { readWatchListContent } from '../../../lib/server/agentStore';
import { encryptTextGCM } from '../../../lib/server/cryptoUtil';

export const dynamic = 'force-dynamic';

// GET /api/backup - Download AES-256-GCM encrypted backup bundle (admin + reauth required)
export async function GET(request: Request) {
  const clientIp = getClientIp(request);
  const { session, user } = getSessionUser(request);

  if (!session || !user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }
  if (user.role !== 'admin') {
    addSystemLog({
      clientIp,
      user: user.username,
      userRealName: user.name,
      category: 'ACCESS_DENIED',
      level: 'ERROR',
      action: 'BACKUP_ACCESS_DENIED',
      detail: `비관리자 '${user.username}'의 시스템 백업 다운로드 시도 차단 (IP: ${clientIp})`,
    });
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }
  if (!isReauthRecentlyVerified(user)) {
    return NextResponse.json(
      { error: '백업 파일 다운로드를 위해 비밀번호 재확인이 필요합니다.', requireReauth: true },
      { status: 403 }
    );
  }

  const backupBundle = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    exportedBy: user.username,
    exportedIp: clientIp,
    watchList: readWatchListContent(),
    users: getAllUsers(),
    systemLogs: readSystemLogs(),
    historyLogs: readHistoryLogs(),
  };

  const encrypted = encryptTextGCM(JSON.stringify(backupBundle), 'backup');

  addSystemLog({
    clientIp,
    user: user.username,
    userRealName: user.name,
    category: 'EVENT',
    level: 'WARN',
    action: 'ENCRYPTED_BACKUP_EXPORTED',
    detail: `관리자 '${user.username}'가 전체 시스템 설정/계정/로그 암호화 백업(.dwbackup)을 생성·다운로드했습니다. (IP: ${clientIp})`,
  });

  return new NextResponse(new Uint8Array(encrypted), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="dockwatch-encrypted-backup-${new Date().toISOString().slice(0, 10)}.dwbackup"`,
      'Cache-Control': 'no-store',
    },
  });
}
