import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { HistoryLogItem } from '../../../lib/types';

function getHistoryFilePath(): string {
  const targetPath = process.env.HISTORY_LOG_PATH || '/app/history_log.bin';
  try {
    if (fs.existsSync(targetPath)) {
      const stat = fs.statSync(targetPath);
      if (stat.isFile()) return targetPath;
      if (stat.isDirectory()) {
        const innerFile = path.join(targetPath, 'data.bin');
        if (!fs.existsSync(innerFile)) {
          fs.writeFileSync(innerFile, '');
        }
        return innerFile;
      }
    } else {
      fs.writeFileSync(targetPath, '');
    }
  } catch (e) {
    return path.join(process.cwd(), 'history_log.bin');
  }
  return targetPath;
}

const MAGIC_HEADER = Buffer.from('DWPTHIST:', 'utf-8');
const SECRET_KEY = crypto.createHash('sha256').update('DockWatch_History_Key_2026').digest();
const SECRET_IV = crypto.createHash('md5').update('DockWatch_History_IV_2026').digest();

function readHistoryLogs(): HistoryLogItem[] {
  const filePath = getHistoryFilePath();
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return [];
  } catch (e) {
    return [];
  }

  try {
    const buffer = fs.readFileSync(filePath);
    let jsonStr = '';
    if (buffer.length >= MAGIC_HEADER.length && buffer.subarray(0, MAGIC_HEADER.length).equals(MAGIC_HEADER)) {
      const encryptedData = buffer.subarray(MAGIC_HEADER.length);
      const decipher = crypto.createDecipheriv('aes-256-cbc', SECRET_KEY, SECRET_IV);
      const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
      jsonStr = decrypted.toString('utf-8');
    } else {
      jsonStr = buffer.toString('utf-8');
    }
    return JSON.parse(jsonStr || '[]');
  } catch (e) {
    console.error('[History API] Failed to read history log', e);
    return [];
  }
}

function writeHistoryLogs(logs: HistoryLogItem[]): void {
  const filePath = getHistoryFilePath();
  const jsonStr = JSON.stringify(logs);
  const cipher = crypto.createCipheriv('aes-256-cbc', SECRET_KEY, SECRET_IV);
  const encrypted = Buffer.concat([cipher.update(jsonStr, 'utf-8'), cipher.final()]);
  const binaryBuffer = Buffer.concat([MAGIC_HEADER, encrypted]);
  fs.writeFileSync(filePath, binaryBuffer);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentName = searchParams.get('agentName');
  const actionType = searchParams.get('actionType');
  const limitStr = searchParams.get('limit');

  let logs = readHistoryLogs();

  if (agentName) {
    logs = logs.filter((l) => l.agentName.toLowerCase().includes(agentName.toLowerCase()));
  }
  if (actionType) {
    logs = logs.filter((l) => l.actionType === actionType);
  }

  // Sort newest first
  logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (limitStr) {
    const limit = parseInt(limitStr, 10);
    if (!isNaN(limit)) logs = logs.slice(0, limit);
  }

  return NextResponse.json({ history: logs }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentName, agentUrl, containerId, containerName, actionType, detail, user } = body;

    if (!actionType || !detail) {
      return NextResponse.json({ error: 'actionType and detail are required' }, { status: 400 });
    }

    const newItem: HistoryLogItem = {
      id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      agentName: agentName || 'System',
      agentUrl: agentUrl || '',
      containerId,
      containerName,
      actionType,
      detail,
      user: user || 'Admin',
    };

    const currentLogs = readHistoryLogs();
    currentLogs.push(newItem);

    // Keep up to 2000 history entries
    const trimmedLogs = currentLogs.slice(-2000);
    writeHistoryLogs(trimmedLogs);

    return NextResponse.json({ success: true, item: newItem });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to record history log' }, { status: 500 });
  }
}
