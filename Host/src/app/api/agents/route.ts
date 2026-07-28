import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { AgentConfig } from '../../../lib/types';

function getWatchListFilePath(): string {
  const candidates = [
    process.env.WATCH_LIST_PATH,
    '/app/watch_list.txt',
    path.join(process.cwd(), 'watch_list.txt'),
    path.join(process.cwd(), '..', 'watch_list.txt'),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  // Default fallback path for docker or local dev
  return process.env.WATCH_LIST_PATH || '/app/watch_list.txt';
}

function parseAgentsFromFile(fileContent: string, serverHostIp: string): AgentConfig[] {
  const agents: AgentConfig[] = [];
  const defaultToken = process.env.DEFAULT_AGENT_TOKEN || '1';

  if (!fileContent) return agents;

  const lines = fileContent.split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const parts = trimmed.split('|').map((p) => p.trim());
    let name = '';
    let url = '';
    let token = defaultToken;

    if (parts.length >= 3) {
      name = parts[0];
      url = parts[1];
      token = parts[2];
    } else if (parts.length === 2) {
      name = parts[0];
      url = parts[1];
    } else {
      url = parts[0];
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `http://${url}`;
      }
      try {
        const parsedUrl = new URL(url);
        name = `Agent (${parsedUrl.hostname})`;
      } catch {
        name = `Agent ${index + 1}`;
      }
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `http://${url}`;
    }

    // Replace localhost with actual server Host IP for remote clients
    if (serverHostIp && serverHostIp !== 'localhost' && serverHostIp !== '127.0.0.1') {
      url = url.replace(/:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/, `://${serverHostIp}$2`);
    }

    agents.push({
      id: `watch-agent-${index + 1}`,
      name,
      url: url.replace(/\/$/, ''),
      token: token || defaultToken,
      isOnline: false,
    });
  });

  return agents;
}

export async function GET(request: Request) {
  const hostHeader = request.headers.get('host') || '';
  const serverHostIp = hostHeader.split(':')[0] || 'localhost';

  const filePath = getWatchListFilePath();
  let fileContent = '';
  if (fs.existsSync(filePath)) {
    try {
      fileContent = fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
      console.error(`[WatchList API] Failed to read ${filePath}`, e);
    }
  }

  const agents = parseAgentsFromFile(fileContent, serverHostIp);
  return NextResponse.json({ agents }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

export async function POST(request: Request) {
  const hostHeader = request.headers.get('host') || '';
  const serverHostIp = hostHeader.split(':')[0] || 'localhost';

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

    const filePath = getWatchListFilePath();
    let existingLines: string[] = [];

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      existingLines = content.split(/\r?\n/);
    }

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
          : `# FakePortainer Agent Watch List\n${newLine}\n`;

      fs.writeFileSync(filePath, newContent, 'utf-8');
    }

    const updatedContent = fs.readFileSync(filePath, 'utf-8');
    const agents = parseAgentsFromFile(updatedContent, serverHostIp);
    return NextResponse.json({ agents, success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    console.error('[WatchList API POST Error]', err);
    return NextResponse.json({ error: err.message || 'Failed to add agent to watch_list.txt' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const hostHeader = request.headers.get('host') || '';
  const serverHostIp = hostHeader.split(':')[0] || 'localhost';

  try {
    const body = await request.json();
    const { url, id } = body;

    if (!url && !id) {
      return NextResponse.json({ error: 'URL or ID is required' }, { status: 400 });
    }

    const filePath = getWatchListFilePath();
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ agents: [], success: true });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);

    const filteredLines = lines.filter((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return true; // preserve comments

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
    fs.writeFileSync(filePath, newContent, 'utf-8');

    const agents = parseAgentsFromFile(newContent, serverHostIp);
    return NextResponse.json({ agents, success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    console.error('[WatchList API DELETE Error]', err);
    return NextResponse.json({ error: err.message || 'Failed to delete agent from watch_list.txt' }, { status: 500 });
  }
}
