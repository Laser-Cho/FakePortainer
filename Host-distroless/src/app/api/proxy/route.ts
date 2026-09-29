import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentUrl, endpoint, method = 'GET', headers = {}, payload } = body;

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
