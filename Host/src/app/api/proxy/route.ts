import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../lib/server/session';
import { addSystemLog } from '../../../lib/server/systemLogStore';

export async function POST(request: Request) {
  try {
    const { session, user } = getSessionUser(request);
    if (!user || user.isLocked) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { agentUrl, endpoint, method = 'GET', headers = {}, payload } = body;

    if (user.role === 'monitor' && method !== 'GET') {
      addSystemLog({
        clientIp: request.headers.get('x-forwarded-for') || 'unknown',
        user: user.username,
        userRealName: user.name,
        category: 'ACCESS_DENIED',
        level: 'WARN',
        action: 'PROXY_METHOD_DENIED',
        detail: `모니터링 권한 사용자가 [${method}] ${endpoint} API 호출을 시도하여 차단되었습니다.`
      });
      return NextResponse.json({ error: 'Permission denied: Monitor role cannot perform this action.' }, { status: 403 });
    }

    if (!agentUrl || !endpoint) {
      return NextResponse.json({ error: 'agentUrl and endpoint are required' }, { status: 400 });
    }

    const cleanBaseUrl = agentUrl.replace(/\/$/, '');
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const targetUrl = `${cleanBaseUrl}${cleanEndpoint}`;

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (payload && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      fetchOptions.body = JSON.stringify(payload);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    fetchOptions.signal = controller.signal;

    try {
      const res = await fetch(targetUrl, fetchOptions);
      clearTimeout(timeoutId);

      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => ({}));
      } else {
        const text = await res.text().catch(() => '');
        data = { rawText: text };
      }

      return NextResponse.json(data, { status: res.status });
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isTimeout = err.name === 'AbortError';
      return NextResponse.json(
        { error: isTimeout ? `Request timed out after 5s` : err.message || 'Agent request failed' },
        { status: 504 }
      );
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Invalid proxy request' }, { status: 500 });
  }
}
