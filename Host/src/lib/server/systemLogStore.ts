import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SystemLogCategory, SystemLogItem, SystemLogLevel } from '../types';

const MAGIC_HEADER = Buffer.from('DWPTSYSLOG:', 'utf-8');
const SECRET_KEY = crypto.createHash('sha256').update('DockWatch_SysLog_Key_2026').digest();
const SECRET_IV = crypto.createHash('md5').update('DockWatch_SysLog_IV_2026').digest();

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  return '127.0.0.1';
}

function getSystemLogsFilePath(): string {
  const candidates = [
    process.env.SYSTEM_LOG_PATH,
    '/app/data/system_logs.bin',
    path.join(process.cwd(), 'data', 'system_logs.bin'),
    path.join(process.cwd(), 'system_logs.bin'),
    path.join(process.cwd(), '..', 'data', 'system_logs.bin'),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const stat = fs.statSync(p);
        if (stat.isFile()) return p;
        if (stat.isDirectory()) {
          const innerFile = path.join(p, 'system_logs.bin');
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
  const targetPath = process.env.SYSTEM_LOG_PATH || path.join(defaultDir, 'system_logs.bin');
  try {
    if (!fs.existsSync(targetPath)) {
      fs.writeFileSync(targetPath, '');
    }
  } catch (e) {}
  return targetPath;
}

export function readSystemLogs(): SystemLogItem[] {
  const filePath = getSystemLogsFilePath();
  try {
    if (!fs.existsSync(filePath)) return [];
    const buffer = fs.readFileSync(filePath);
    if (buffer.length === 0) return [];

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
    console.error('[SystemLogStore] Failed to read system logs', e);
    return [];
  }
}

function writeSystemLogs(logs: SystemLogItem[]): void {
  const filePath = getSystemLogsFilePath();
  // Keep up to 20,000 entries
  const trimmed = logs.slice(0, 20000);
  const jsonStr = JSON.stringify(trimmed);
  const cipher = crypto.createCipheriv('aes-256-cbc', SECRET_KEY, SECRET_IV);
  const encrypted = Buffer.concat([cipher.update(jsonStr, 'utf-8'), cipher.final()]);
  const binaryBuffer = Buffer.concat([MAGIC_HEADER, encrypted]);
  fs.writeFileSync(filePath, binaryBuffer);
}

export function addSystemLog(entry: {
  clientIp: string;
  user: string;
  userRealName?: string;
  category: SystemLogCategory;
  level?: SystemLogLevel;
  action: string;
  detail: string;
}): SystemLogItem {
  const logs = readSystemLogs();
  const newLog: SystemLogItem = {
    id: `syslog-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    clientIp: entry.clientIp || '127.0.0.1',
    user: entry.user || 'anonymous',
    userRealName: entry.userRealName,
    category: entry.category,
    level: entry.level || (entry.category === 'LOGIN_FAILURE' || entry.category === 'ACCESS_DENIED' ? 'WARN' : 'INFO'),
    action: entry.action,
    detail: entry.detail,
  };

  // Add at the beginning (newest first)
  logs.unshift(newLog);
  writeSystemLogs(logs);
  return newLog;
}
