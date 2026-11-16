import { NextResponse } from 'next/server';
import {
  readSystemLogs,
  addSystemLog,
  getClientIp,
  verifySystemLogsIntegrity,
} from '../../../lib/server/systemLogStore';
import { getSessionUser } from '../../../lib/server/session';

export const dynamic = 'force-dynamic';

function escapeCsv(val: unknown): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: Request) {
  const { session, user } = getSessionUser(request);
  const clientIp = getClientIp(request);

  if (!session || !user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  // Only admin can access/download full system security logs (항목 25-③④)
  if (user.role !== 'admin') {
    addSystemLog({
      clientIp,
      user: user.username,
      userRealName: user.name,
      category: 'ACCESS_DENIED',
      level: 'ERROR',
      action: 'SYSTEM_LOG_ACCESS_DENIED',
      detail: `비관리자 계정 '${user.username}' (${user.role})의 시스템 보안 로그 열람 시도 차단 (IP: ${clientIp})`,
    });
    return NextResponse.json({ error: '시스템 보안 로그는 관리자만 조회할 수 있습니다.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const level = searchParams.get('level');
  const userFilter = searchParams.get('user');
  const search = searchParams.get('search');
  const limitStr = searchParams.get('limit') || '500';
  const verify = searchParams.get('verify') === 'true';
  const format = searchParams.get('format');

  let logs = readSystemLogs();

  if (category && category !== 'ALL') {
    logs = logs.filter((l) => l.category === category);
  }
  if (level && level !== 'ALL') {
    logs = logs.filter((l) => l.level === level);
  }
  if (userFilter) {
    logs = logs.filter((l) => l.user.toLowerCase().includes(userFilter.toLowerCase()));
  }
  if (search) {
    const q = search.toLowerCase();
    logs = logs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.detail.toLowerCase().includes(q) ||
        l.clientIp.includes(q) ||
        l.user.toLowerCase().includes(q) ||
        (l.userRealName && l.userRealName.toLowerCase().includes(q))
    );
  }

  const limit = parseInt(limitStr, 10);
  if (!format && !isNaN(limit) && limit > 0) {
    logs = logs.slice(0, limit);
  }

  if (format === 'csv') {
    addSystemLog({
      clientIp,
      user: user.username,
      userRealName: user.name,
      category: 'EVENT',
      level: 'WARN',
      action: 'SYSTEM_LOG_EXPORTED',
      detail: `관리자 '${user.username}'가 시스템 보안 로그 CSV 파일(${logs.length}건)을 다운로드했습니다. (IP: ${clientIp})`,
    });

    const header = ['ID', 'Timestamp', 'Category', 'Level', 'ClientIP', 'User', 'RealName', 'Action', 'Detail', 'EntryHash'];
    const rows = logs.map((l) =>
      [l.id, l.timestamp, l.category, l.level, l.clientIp, l.user, l.userRealName || '', l.action, l.detail, l.entryHash || '']
        .map(escapeCsv)
        .join(',')
    );
    const csv = '\uFEFF' + [header.join(','), ...rows].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="dockwatch-system-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const integrity = verify ? verifySystemLogsIntegrity() : undefined;
  return NextResponse.json({ logs, integrity }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const { session, user } = getSessionUser(request);

  if (!session || !user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { category, action, detail, level } = body;

    if (!category || !action || !detail) {
      return NextResponse.json({ error: 'category, action, and detail are required' }, { status: 400 });
    }

    const log = addSystemLog({
      clientIp,
      user: user.username,
      userRealName: user.name,
      category,
      level,
      action,
      detail,
    });

    return NextResponse.json({ success: true, log });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '로그 생성 실패' }, { status: 500 });
  }
}
