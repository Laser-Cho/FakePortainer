import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AgentConfig } from '../../../lib/types';

const MAGIC_HEADER = Buffer.from('DWPT_BIN:', 'utf-8');
const SECRET_KEY = crypto.createHash('sha256').update('DockWatch_Secret_Key_2026').digest();
const SECRET_IV = crypto.createHash('md5').update('DockWatch_IV_2026').digest();

function encryptTextToBinary(text: string): Buffer {
  const cipher = crypto.createCipheriv('aes-256-cbc', SECRET_KEY, SECRET_IV);
  const encrypted = Buffer.concat([cipher.update(text, 'utf-8'), cipher.final()]);
  return Buffer.concat([MAGIC_HEADER, encrypted]);
}

function decryptBinaryToText(buffer: Buffer): string {
  if (buffer.length >= MAGIC_HEADER.length && buffer.subarray(0, MAGIC_HEADER.length).equals(MAGIC_HEADER)) {
    const encryptedData = buffer.subarray(MAGIC_HEADER.length);
    const decipher = crypto.createDecipheriv('aes-256-cbc', SECRET_KEY, SECRET_IV);
    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    return decrypted.toString('utf-8');
  }
  // Fallback for legacy plain text file
  return buffer.toString('utf-8');
}

function getWatchListFilePath(): string {
  const candidates = [
    process.env.WATCH_LIST_PATH,
    '/app/watch_list.bin',
    '/app/watch_list.txt',
    path.join(process.cwd(), 'watch_list.bin'),
    path.join(process.cwd(), 'watch_list.txt'),
    path.join(process.cwd(), '..', 'watch_list.bin'),
    path.join(process.cwd(), '..', 'watch_list.txt'),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const stat = fs.statSync(p);
        if (stat.isFile()) return p;
        if (stat.isDirectory()) {
          const innerFile = path.join(p, 'data.bin');
          if (!fs.existsSync(innerFile)) {
            fs.writeFileSync(innerFile, '');
          }
          return innerFile;
        }
      }
    } catch (e) {}
  }
  const defaultPath = process.env.WATCH_LIST_PATH || '/app/watch_list.txt';
  try {
    if (!fs.existsSync(defaultPath)) {
      fs.writeFileSync(defaultPath, '');
    }
  } catch (e) {}
  return defaultPath;
}

function parseAgentsFromFileContent(fileContent: string): AgentConfig[] {
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

function readWatchListContent(): string {
  const filePath = getWatchListFilePath();
  if (fs.existsSync(filePath)) {
    try {
      const buffer = fs.readFileSync(filePath);
      return decryptBinaryToText(buffer);
    } catch (e) {
      console.error(`[WatchList API] Failed to read ${filePath}`, e);
    }
  }
  return '';
}

function writeWatchListContent(content: string): void {
  const filePath = getWatchListFilePath();
  const binaryBuffer = encryptTextToBinary(content);
  fs.writeFileSync(filePath, binaryBuffer);
}

export async function GET(request: Request) {
  const fileContent = readWatchListContent();
  const agents = parseAgentsFromFileContent(fileContent);
  return NextResponse.json({ agents }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

export async function POST(request: Request) {
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

    const updatedContent = readWatchListContent();
    const agents = parseAgentsFromFileContent(updatedContent);
    return NextResponse.json({ agents, success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    console.error('[WatchList API DELETE Error]', err);
    return NextResponse.json({ error: err.message || 'Failed to delete agent from watch_list' }, { status: 500 });
  }
}

