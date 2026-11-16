import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SystemLogCategory, SystemLogItem, SystemLogLevel } from '../types';
import { computeLogChainHash, decryptBufferAuto, encryptTextGCM, normalizeIp } from './cryptoUtil';

const LEGACY_HEADER = Buffer.from('DWPTSYSLOG:', 'utf-8');
const LEGACY_KEY = crypto.createHash('sha256').update('DockWatch_SysLog_Key_2026').digest();
const LEGACY_IV = crypto.createHash('md5').update('DockWatch_SysLog_IV_2026').digest();

const LONG_RETENTION_CATEGORIES: SystemLogCategory[] = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILURE',
  'ACCESS_DENIED',
  'ROLE_CHANGE',
  'USER_MGMT',
  'SECURITY_ALERT',
  'LOG_REVIEW',
];

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return normalizeIp(first);
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return normalizeIp(realIp);

  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return normalizeIp(cfIp);

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
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
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

    const jsonStr = decryptBufferAuto(buffer, 'syslogs', {
      header: LEGACY_HEADER,
      key: LEGACY_KEY,
      iv: LEGACY_IV,
    });
    return JSON.parse(jsonStr || '[]');
  } catch (e) {
    console.error('[SystemLogStore] Failed to read system logs', e);
    return [];
  }
}

function applyRetentionPolicy(logs: SystemLogItem[]): SystemLogItem[] {
  const generalDays = Math.max(365, parseInt(process.env.LOG_RETENTION_DAYS || '365', 10) || 365);
  const authDays = Math.max(1825, parseInt(process.env.AUTH_LOG_RETENTION_DAYS || '1825', 10) || 1825);
  const now = Date.now();
  const generalCutoff = now - generalDays * 24 * 60 * 60 * 1000;
  const authCutoff = now - authDays * 24 * 60 * 60 * 1000;

  return logs
    .filter((item) => {
      const ts = new Date(item.timestamp).getTime();
      if (isNaN(ts)) return true;
      const cutoff = LONG_RETENTION_CATEGORIES.includes(item.category) ? authCutoff : generalCutoff;
      return ts >= cutoff;
    })
    .slice(0, 100000);
}

function writeSystemLogs(logs: SystemLogItem[]): void {
  const filePath = getSystemLogsFilePath();
  const retained = applyRetentionPolicy(logs);
  const binaryBuffer = encryptTextGCM(JSON.stringify(retained), 'syslogs');
  fs.writeFileSync(filePath, binaryBuffer, { mode: 0o600 });
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
  const prevHash = logs.length > 0 && logs[0].entryHash ? logs[0].entryHash : 'GENESIS';

  const basePayload = {
    id: `syslog-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    clientIp: normalizeIp(entry.clientIp || '127.0.0.1'),
    user: entry.user || 'anonymous',
    userRealName: entry.userRealName,
    category: entry.category,
    level:
      entry.level ||
      (entry.category === 'LOGIN_FAILURE' || entry.category === 'ACCESS_DENIED' || entry.category === 'SECURITY_ALERT'
        ? 'WARN'
        : 'INFO'),
    action: entry.action,
    detail: entry.detail,
  };

  const entryHash = computeLogChainHash(prevHash, basePayload);
  const newLog: SystemLogItem = {
    ...basePayload,
    prevHash,
    entryHash,
  };

  // Add at the beginning (newest first)
  logs.unshift(newLog);
  writeSystemLogs(logs);
  return newLog;
}

export function verifySystemLogsIntegrity(): {
  valid: boolean;
  totalLogs: number;
  verifiedCount: number;
  legacyUnchainedCount: number;
  tamperedIds: string[];
} {
  const logs = readSystemLogs();
  // Stored newest-first; verify oldest -> newest
  const chronological = [...logs].reverse();
  const tamperedIds: string[] = [];
  let verifiedCount = 0;
  let legacyUnchainedCount = 0;
  let expectedPrevHash = 'GENESIS';

  for (const item of chronological) {
    if (!item.entryHash) {
      legacyUnchainedCount++;
      expectedPrevHash = 'GENESIS';
      continue;
    }

    const { prevHash, entryHash, ...rest } = item;
    const recomputed = computeLogChainHash(prevHash || 'GENESIS', rest);
    if (recomputed !== entryHash || (verifiedCount > 0 && prevHash !== expectedPrevHash)) {
      tamperedIds.push(item.id);
    } else {
      verifiedCount++;
    }
    expectedPrevHash = entryHash;
  }

  return {
    valid: tamperedIds.length === 0,
    totalLogs: logs.length,
    verifiedCount,
    legacyUnchainedCount,
    tamperedIds,
  };
}
