import { NextResponse } from 'next/server';
import {
  readWatchListContent,
  writeWatchListContent,
  parseAgentsFromFileContent,
} from '../../../lib/server/agentStore';
import { addSystemLog, getClientIp } from '../../../lib/server/systemLogStore';
import { getSessionUser } from '../../../lib/server/session';

export async function GET(request: Request) {
  const fileContent = readWatchListContent();
  const agents = parseAgentsFromFileContent(fileContent);
  return NextResponse.json({ agents }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const { user } = getSessionUser(request);
  try {
    const body = await request.json();
    const { name, url, token } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `http://${targetUrl}`;
    }
    targetUrl = targetUrl.replace(/\/$/, '');

    const targetName = (name || `Agent (${targetUrl})`).trim();
    const targetToken = (token || '1').trim();

    const existingContent = readWatchListContent();
    const existingLines = existingContent ? existingContent.split(/\r?\n/) : [];

    // Check if URL already exists
    const lineExists = existingLines.some((l) => {
      const trimmed = l.trim();
      if (!trimmed || trimmed.startsWith('#')) return false;
      const parts = trimmed.split('|').map((p) => p.trim());
      const existingUrl = parts.length >= 2 ? parts[1] : parts[0];
      return existingUrl.replace(/\/$/, '') === targetUrl;
    });

    if (!lineExists) {
      const newLine = `${targetName}|${targetUrl}|${targetToken}`;
      const newContent =
        existingLines.length > 0
          ? `${existingLines.join('\n').trim()}\n${newLine}\n`
          : `# DockWatch Agent Watch List\n${newLine}\n`;

      writeWatchListContent(newContent);

      addSystemLog({
        clientIp,
        user: user ? user.username : 'Admin',
        userRealName: user ? user.name : undefined,
        category: 'USER_MGMT',
        level: 'INFO',
        action: 'AGENT_NODE_ADDED',
        detail: `새로운 에이전트 노드 등록: [${targetName}] URL: ${targetUrl} (IP: ${clientIp})`,
      });
    }

    const updatedContent = readWatchListContent();
    const agents = parseAgentsFromFileContent(updatedContent);
    return NextResponse.json({ agents, success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    console.error('[WatchList API POST Error]', err);
    return NextResponse.json({ error: err.message || 'Failed to add agent to watch_list' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const clientIp = getClientIp(request);
  const { user } = getSessionUser(request);
  try {
    const body = await request.json();
    const { url, id } = body;

    if (!url && !id) {
      return NextResponse.json({ error: 'URL or ID is required' }, { status: 400 });
    }

    const existingContent = readWatchListContent();
    if (!existingContent) {
      return NextResponse.json({ agents: [], success: true });
    }

    const lines = existingContent.split(/\r?\n/);
    const filteredLines = lines.filter((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return true;

      const parts = trimmed.split('|').map((p) => p.trim());
      let lineUrl = parts.length >= 2 ? parts[1] : parts[0];
      if (!lineUrl.startsWith('http://') && !lineUrl.startsWith('https://')) {
        lineUrl = `http://${lineUrl}`;
      }
      lineUrl = lineUrl.replace(/\/$/, '');

      if (url) {
        let normalizedTarget = url.trim();
        if (!normalizedTarget.startsWith('http://') && !normalizedTarget.startsWith('https://')) {
          normalizedTarget = `http://${normalizedTarget}`;
        }
        normalizedTarget = normalizedTarget.replace(/\/$/, '');

        if (lineUrl === normalizedTarget) return false;
      }

      return true;
    });

    const newContent = filteredLines.join('\n').trim() + '\n';
    writeWatchListContent(newContent);

    addSystemLog({
      clientIp,
      user: user ? user.username : 'Admin',
      userRealName: user ? user.name : undefined,
      category: 'USER_MGMT',
      level: 'WARN',
      action: 'AGENT_NODE_REMOVED',
      detail: `에이전트 노드 등록 해제: ${url || id} (IP: ${clientIp})`,
    });

    const updatedContent = readWatchListContent();
    const agents = parseAgentsFromFileContent(updatedContent);
    return NextResponse.json({ agents, success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    console.error('[WatchList API DELETE Error]', err);
    return NextResponse.json({ error: err.message || 'Failed to delete agent from watch_list' }, { status: 500 });
  }
}
