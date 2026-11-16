import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../lib/server/session';
import { getWatchListAgents } from '../../../lib/server/agentStore';
import { signAgentJwt } from '../../../lib/server/cryptoUtil';

export async function POST(request: Request) {
  const { session, user } = getSessionUser(request);
  if (!session || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { agentUrl, containerId } = body;
    if (!agentUrl) {
      return NextResponse.json({ error: 'agentUrl is required' }, { status: 400 });
    }

    const normalized = agentUrl.trim().replace(/\/$/, '');
    const agents = getWatchListAgents();
    const matched = agents.find((a) => a.url === normalized);
    if (!matched || !matched.token) {
      return NextResponse.json({ error: 'Registered agent not found' }, { status: 403 });
    }

    // Short-lived 5-minute scoped JWT so raw AGENT_SECRET_TOKEN is never exposed to the browser
    const wsToken = signAgentJwt(
      matched.token,
      {
        sub: user.username,
        role: user.role,
        containerId: containerId || '*',
      },
      300
    );

    return NextResponse.json({ wsToken });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to issue WS token' }, { status: 500 });
  }
}
