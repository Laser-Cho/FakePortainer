import { NextResponse } from 'next/server';
import { readSystemLogs, addSystemLog, getClientIp } from '../../../lib/server/systemLogStore';
import { getSessionUser } from '../../../lib/server/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { session, user } = getSessionUser(request);
  const clientIp = getClientIp(request);

  if (!session || !user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const level = searchParams.get('level');
  const userFilter = searchParams.get('user');
  const search = searchParams.get('search');
  const limitStr = searchParams.get('limit') || '500';

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
  if (!isNaN(limit) && limit > 0) {
    logs = logs.slice(0, limit);
  }

  return NextResponse.json({ logs }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const { user } = getSessionUser(request);

  try {
    const body = await request.json();
    const { category, action, detail, level, customUser } = body;

    if (!category || !action || !detail) {
      return NextResponse.json({ error: 'category, action, and detail are required' }, { status: 400 });
    }

    const log = addSystemLog({
      clientIp,
      user: customUser || (user ? user.username : 'anonymous'),
      userRealName: user ? user.name : undefined,
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
