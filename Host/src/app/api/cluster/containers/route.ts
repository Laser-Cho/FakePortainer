import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getWatchListAgents } from '../../../../lib/server/agentStore';
import { addSystemLog, getClientIp } from '../../../../lib/server/systemLogStore';
import { getSessionUser } from '../../../../lib/server/session';
import { ClusterStatusResponse, ClusterNodeSummary, ContainerInfo } from '../../../../lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const clientIp = getClientIp(request);
  const { session, user } = getSessionUser(request);

  // Support either authenticated user session OR dedicated CLUSTER_API_KEY header for external system integration
  const apiKeyHeader = request.headers.get('x-api-key') || '';
  const clusterApiKey = process.env.CLUSTER_API_KEY || '';
  let validApiKey = false;
  if (clusterApiKey && apiKeyHeader.length === clusterApiKey.length && apiKeyHeader.length > 0) {
    validApiKey = crypto.timingSafeEqual(Buffer.from(apiKeyHeader), Buffer.from(clusterApiKey));
  }

  if ((!session || !user) && !validApiKey) {
    addSystemLog({
      clientIp,
      user: 'anonymous',
      category: 'ACCESS_DENIED',
      level: 'WARN',
      action: 'CLUSTER_API_UNAUTHORIZED',
      detail: `미인증 상태에서 전 서버 컨테이너 상태 API(/api/cluster/containers) 호출 차단 (IP: ${clientIp})`,
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const agents = getWatchListAgents();

    const results = await Promise.allSettled(
      agents.map(async (agent) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        try {
          const healthRes = await fetch(`${agent.url}/health`, {
            method: 'GET',
            signal: controller.signal,
          });

          if (!healthRes.ok) {
            clearTimeout(timeoutId);
            return {
              agent,
              isOnline: false,
              containers: [] as ContainerInfo[],
            };
          }

          const containersRes = await fetch(`${agent.url}/api/containers`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${agent.token}`,
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!containersRes.ok) {
            return {
              agent,
              isOnline: true,
              containers: [] as ContainerInfo[],
            };
          }

          const data = await containersRes.json();
          const rawContainers: ContainerInfo[] = data.containers || [];

          const enriched = rawContainers.map((c) => ({
            ...c,
            agentName: agent.name,
            agentUrl: agent.url,
            nodeId: agent.id,
            nodeName: agent.name,
            nodeUrl: agent.url,
            nodeStatus: 'online',
          }));

          return {
            agent,
            isOnline: true,
            containers: enriched,
          };
        } catch (err: any) {
          clearTimeout(timeoutId);
          return {
            agent,
            isOnline: false,
            containers: [] as ContainerInfo[],
          };
        }
      })
    );

    const nodesSummary: ClusterNodeSummary[] = [];
    const allContainers: ContainerInfo[] = [];

    let totalContainers = 0;
    let runningContainers = 0;
    let stoppedContainers = 0;
    let onlineNodes = 0;
    let offlineNodes = 0;

    results.forEach((res, index) => {
      const fallbackAgent = agents[index];
      if (res.status === 'fulfilled') {
        const { agent, isOnline, containers } = res.value;
        const running = containers.filter((c) => c.state === 'running').length;
        const stopped = containers.length - running;

        if (isOnline) onlineNodes++;
        else offlineNodes++;

        totalContainers += containers.length;
        runningContainers += running;
        stoppedContainers += stopped;

        nodesSummary.push({
          id: agent.id,
          name: agent.name,
          url: agent.url,
          isOnline,
          containersCount: containers.length,
          runningCount: running,
          stoppedCount: stopped,
        });

        allContainers.push(...containers);
      } else {
        offlineNodes++;
        nodesSummary.push({
          id: fallbackAgent.id,
          name: fallbackAgent.name,
          url: fallbackAgent.url,
          isOnline: false,
          containersCount: 0,
          runningCount: 0,
          stoppedCount: 0,
        });
      }
    });

    const responsePayload: ClusterStatusResponse = {
      timestamp: new Date().toISOString(),
      summary: {
        totalNodes: agents.length,
        onlineNodes,
        offlineNodes,
        totalContainers,
        runningContainers,
        stoppedContainers,
      },
      nodes: nodesSummary,
      containers: allContainers,
    };

    addSystemLog({
      clientIp,
      user: user ? user.username : 'API_KEY_CLIENT',
      userRealName: user ? user.name : undefined,
      category: 'EVENT',
      level: 'INFO',
      action: 'CLUSTER_CONTAINERS_QUERY',
      detail: `전 관제 서버(${agents.length}개 노드) 도커 컨테이너 상태 API 조회 완료 - 총 컨테이너: ${totalContainers}개 (실행 중: ${runningContainers}개) (요청 IP: ${clientIp})`,
    });

    return NextResponse.json(responsePayload, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: any) {
    console.error('[Cluster Containers API Error]', err);
    return NextResponse.json(
      { error: err.message || '클러스터 컨테이너 목록 조회 실패' },
      { status: 500 }
    );
  }
}
