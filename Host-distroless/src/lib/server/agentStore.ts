import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AgentConfig } from '../types';
import { decryptBufferAuto, encryptTextGCM } from './cryptoUtil';

const LEGACY_HEADER = Buffer.from('DWPT_BIN:', 'utf-8');
const LEGACY_KEY = crypto.createHash('sha256').update('DockWatch_Secret_Key_2026').digest();
const LEGACY_IV = crypto.createHash('md5').update('DockWatch_IV_2026').digest();

export function encryptTextToBinary(text: string): Buffer {
  return encryptTextGCM(text, 'agents');
}

export function decryptBinaryToText(buffer: Buffer): string {
  return decryptBufferAuto(buffer, 'agents', {
    header: LEGACY_HEADER,
    key: LEGACY_KEY,
    iv: LEGACY_IV,
  });
}

export function getWatchListFilePath(): string {
  const candidates = [
    process.env.WATCH_LIST_PATH,
    '/app/watch_list.bin',
    '/app/watch_list.txt',
    path.join(process.cwd(), 'data', 'watch_list.bin'),
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

  const defaultDir = path.join(process.cwd(), 'data');
  try {
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }
  } catch (e) {}

  const defaultPath = process.env.WATCH_LIST_PATH || path.join(defaultDir, 'watch_list.bin');
  try {
    const parentDir = path.dirname(defaultPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    if (!fs.existsSync(defaultPath)) {
      fs.writeFileSync(defaultPath, '');
    }
  } catch (e) {}
  return defaultPath;
}

export function parseAgentsFromFileContent(fileContent: string): AgentConfig[] {
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

export function readWatchListContent(): string {
  const filePath = getWatchListFilePath();
  if (fs.existsSync(filePath)) {
    try {
      const buffer = fs.readFileSync(filePath);
      return decryptBinaryToText(buffer);
    } catch (e) {
      console.error(`[WatchList Store] Failed to read ${filePath}`, e);
    }
  }
  return '';
}

export function writeWatchListContent(content: string): void {
  const filePath = getWatchListFilePath();
  const binaryBuffer = encryptTextToBinary(content);
  fs.writeFileSync(filePath, binaryBuffer, { mode: 0o600 });
}

export function getWatchListAgents(): AgentConfig[] {
  const content = readWatchListContent();
  return parseAgentsFromFileContent(content);
}

/**
 * Returns agent list safe for client responses (never leaks raw secret token).
 */
export function getSafeWatchListAgents(): AgentConfig[] {
  return getWatchListAgents().map((ag) => ({
    id: ag.id,
    name: ag.name,
    url: ag.url,
    hasToken: !!ag.token,
    isOnline: ag.isOnline,
  }));
}
