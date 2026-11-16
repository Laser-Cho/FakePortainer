import { NextResponse } from 'next/server';
import { getClientIp, addSystemLog } from '../../../lib/server/systemLogStore';
import { getSessionUser } from '../../../lib/server/session';
import {
  appendHistoryLog,
  readHistoryLogs,
  verifyHistoryLogsIntegrity,
} from '../../../lib/server/historyStore';

export const dynamic = 'force-dynamic';

function escapeCsv(val: unknown): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: Request) {
  const clientIp = getClientIp(request);
  const { session, user } = getSessionUser(request);

  if (!session || !user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const agentName = searchParams.get('agentName');
  const actionType = searchParams.get('actionType');
  const limitStr = searchParams.get('limit');
  const verify = searchParams.get('verify') === 'true';
  const format = searchParams.get('format');

  let logs = readHistoryLogs();

  if (agentName) {
    logs = logs.filter((l) => l.agentName.toLowerCase().includes(agentName.toLowerCase()));
  }
  if (actionType) {
    logs = logs.filter((l) => l.actionType === actionType);
  }

  logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (limitStr) {
    const limit = parseInt(limitStr, 10);
    if (!isNaN(limit)) logs = logs.slice(0, limit);
  }

  if (format === 'csv') {
    addSystemLog({
      clientIp,
      user: user.username,
      userRealName: user.name,
      category: 'EVENT',
      level: 'INFO',
      action: 'HISTORY_LOG_EXPORTED',
      detail: `사용자 '${user.username}'가 작업 내역 CSV 파일(${logs.length}건)을 다운로드했습니다. (IP: ${clientIp})`,
    });

    const header = ['ID', 'Timestamp', 'User', 'RealName', 'ClientIP', 'AgentName', 'ActionType', 'Container', 'Detail', 'EntryHash'];
    const rows = logs.map((l) =>
      [
        l.id,
        l.timestamp,
        l.user || '',
        l.userRealName || '',
        l.clientIp || '',
        l.agentName,
        l.actionType,
        l.containerName || '',
        l.detail,
        l.entryHash || '',
      ]
        .map(escapeCsv)
        .join(',')
    );
    const csv = '\uFEFF' + [header.join(','), ...rows].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="dockwatch-activity-history-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const integrity = verify ? verifyHistoryLogsIntegrity() : undefined;
  return NextResponse.json({ history: logs, integrity }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const { session, user: sessionUser } = getSessionUser(request);

    if (!session || !sessionUser) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    if (sessionUser.role === 'monitor') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { agentName, agentUrl, containerId, containerName, actionType, detail } = body;

    if (!actionType || !detail) {
      return NextResponse.json({ error: 'actionType and detail are required' }, { status: 400 });
    }

    // Enforce authenticated operator identity (prevent spoofing another user)
    const resolvedUser = sessionUser.username;
    const resolvedRealName = sessionUser.name;

    const newItem = appendHistoryLog({
      agentName: agentName || 'System',
      agentUrl: agentUrl || '',
      containerId,
      containerName,
      actionType,
      detail,
      user: resolvedUser,
      userRealName: resolvedRealName,
      clientIp: clientIp || '127.0.0.1',
    });

    try {
      addSystemLog({
        clientIp,
        user: resolvedUser,
        userRealName: resolvedRealName,
        category: 'OPERATION',
        level: String(actionType).includes('DELETE') ? 'WARN' : 'INFO',
        action: actionType,
        detail: `[${agentName || 'Node'}] ${detail}`,
      });
    } catch (e) {}

    return NextResponse.json({ success: true, item: newItem });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to record history log' }, { status: 500 });
  }
}
