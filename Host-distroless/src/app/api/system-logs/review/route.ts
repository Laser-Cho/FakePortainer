import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../../lib/server/session';
import {
  addSystemLog,
  getClientIp,
  readSystemLogs,
  verifySystemLogsIntegrity,
} from '../../../../lib/server/systemLogStore';
import { verifyHistoryLogsIntegrity } from '../../../../lib/server/historyStore';
import { getUserProfiles } from '../../../../lib/server/userStore';

export const dynamic = 'force-dynamic';

// POST /api/system-logs/review - Perform periodic access log inspection and record report
export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const { session, user } = getSessionUser(request);

  if (!session || !user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const note = String(body?.note || '정기 접속기록 및 이상징후 점검 완료').trim();

    const sysLogs = readSystemLogs();
    const last30DaysMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentLogs = sysLogs.filter((l) => new Date(l.timestamp).getTime() >= last30DaysMs);

    const sysIntegrity = verifySystemLogsIntegrity();
    const histIntegrity = verifyHistoryLogsIntegrity();
    const users = getUserProfiles();

    const report = {
      reviewedAt: new Date().toISOString(),
      reviewer: `${user.name} (${user.username})`,
      reviewerIp: clientIp,
      note,
      summaryLast30Days: {
        totalEvents: recentLogs.length,
        loginSuccess: recentLogs.filter((l) => l.category === 'LOGIN_SUCCESS').length,
        loginFailures: recentLogs.filter((l) => l.category === 'LOGIN_FAILURE').length,
        accessDenied: recentLogs.filter((l) => l.category === 'ACCESS_DENIED').length,
        roleChanges: recentLogs.filter((l) => l.category === 'ROLE_CHANGE').length,
        securityAlerts: recentLogs.filter((l) => l.category === 'SECURITY_ALERT').length,
      },
      accountSecurityStatus: {
        totalUsers: users.length,
        lockedUsers: users.filter((u) => u.isLocked).length,
        expiredPasswords: users.filter((u) => u.requirePasswordChange).length,
        twoFactorEnabledUsers: users.filter((u) => u.twoFactorEnabled).length,
      },
      integrity: {
        systemLogs: sysIntegrity,
        historyLogs: histIntegrity,
      },
    };

    addSystemLog({
      clientIp,
      user: user.username,
      userRealName: user.name,
      category: 'LOG_REVIEW',
      level: sysIntegrity.valid && histIntegrity.valid ? 'INFO' : 'ERROR',
      action: 'PERIODIC_LOG_REVIEW_COMPLETED',
      detail: `[접속기록 정기점검] 점검자: ${user.username}, 최근30일 실패:${report.summaryLast30Days.loginFailures}건/차단:${report.summaryLast30Days.accessDenied}건, 무결성:${
        sysIntegrity.valid && histIntegrity.valid ? '정상' : '변조의심'
      }, 소견: ${note}`,
    });

    return NextResponse.json({ success: true, report });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '점검 리포트 생성 실패' }, { status: 500 });
  }
}
