import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../lib/server/session';
import { addSystemLog, getClientIp } from '../../../lib/server/systemLogStore';
import { getWatchListAgents } from '../../../lib/server/agentStore';

const ALLOWED_ENDPOINT_PATTERNS = [
  /^\/health$/,
  /^\/api\/containers$/,
  /^\/api\/containers\/[a-zA-Z0-9_.-]+\/(start|stop|restart)$/,
  /^\/api\/containers\/[a-zA-Z0-9_.-]+\/?(\?.*)?$/,
  /^\/api\/images$/,
  /^\/api\/images\/prune$/,
  /^\/api\/volumes$/,
  /^\/api\/volumes\/[a-zA-Z0-9_.%-]+$/,
  /^\/api\/system\/logs$/,
  /^\/api\/system\/htop$/,
];

function isAllowedEndpoint(endpoint: string): boolean {
  if (!endpoint || endpoint.includes('..') || endpoint.includes('\\')) return false;
  return ALLOWED_ENDPOINT_PATTERNS.some((re) => re.test(endpoint));
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  try {
    const isBgPoll = request.headers.get('x-background-poll') === 'true';
    const { session, user, errorReason } = getSessionUser(request, { isBackgroundPoll: isBgPoll });
    if (!session || !user || user.isLocked) {
      return NextResponse.json(
        {
          error:
            errorReason === 'IDLE_TIMEOUT'
              ? '10분 이상 활동이 없어 자동 로그아웃되었습니다.'
              : errorReason === 'CONCURRENT_SESSION'
              ? '다른 위치에서 로그인되어 세션이 종료되었습니다.'
              : 'Unauthorized',
          idleTimedOut: errorReason === 'IDLE_TIMEOUT',
          concurrentSessionBlocked: errorReason === 'CONCURRENT_SESSION',
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { agentUrl, endpoint, method = 'GET', payload } = body;

    if (user.role === 'monitor' && method !== 'GET') {
      addSystemLog({
        clientIp,
        user: user.username,
        userRealName: user.name,
        category: 'ACCESS_DENIED',
        level: 'WARN',
        action: 'PROXY_METHOD_DENIED',
        detail: `모니터링 권한 사용자가 [${method}] ${endpoint} API 호출을 시도하여 차단되었습니다. (IP: ${clientIp})`,
      });
      return NextResponse.json({ error: 'Permission denied: Monitor role cannot perform this action.' }, { status: 403 });
    }

    if (!agentUrl || !endpoint) {
      return NextResponse.json({ error: 'agentUrl and endpoint are required' }, { status: 400 });
    }

    const cleanBaseUrl = String(agentUrl).trim().replace(/\/$/, '');
    const cleanEndpoint = String(endpoint).startsWith('/') ? String(endpoint) : `/${endpoint}`;

    // SSRF protection: allow proxying only to registered watch_list agents
    const registeredAgents = getWatchListAgents();
    const matchedAgent = registeredAgents.find((a) => a.url === cleanBaseUrl);
    if (!matchedAgent) {
      addSystemLog({
        clientIp,
        user: user.username,
        userRealName: user.name,
        category: 'ACCESS_DENIED',
        level: 'ERROR',
        action: 'PROXY_SSRF_BLOCKED',
        detail: `미등록 에이전트 URL('${cleanBaseUrl}')로의 프록시 요청이 차단되었습니다. (IP: ${clientIp})`,
      });
      return NextResponse.json({ error: 'Forbidden: Unregistered agent URL' }, { status: 403 });
    }

    if (!isAllowedEndpoint(cleanEndpoint)) {
      addSystemLog({
        clientIp,
        user: user.username,
        userRealName: user.name,
        category: 'ACCESS_DENIED',
        level: 'WARN',
        action: 'PROXY_ENDPOINT_BLOCKED',
        detail: `허용되지 않은 에이전트 엔드포인트('${cleanEndpoint}') 호출 차단 (IP: ${clientIp})`,
      });
      return NextResponse.json({ error: 'Forbidden endpoint' }, { status: 403 });
    }

    const targetUrl = `${cleanBaseUrl}${cleanEndpoint}`;

    // Inject Agent token strictly on server side (browser never handles raw AGENT_SECRET_TOKEN)
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${matchedAgent.token || '1'}`,
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
        { error: isTimeout ? 'Request timed out after 5s' : 'Agent request failed' },
        { status: 504 }
      );
    }
  } catch (err: any) {
    return NextResponse.json({ error: 'Invalid proxy request' }, { status: 500 });
  }
}
