import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { HistoryLogItem } from '../types';
import { computeLogChainHash, decryptBufferAuto, encryptTextGCM, normalizeIp } from './cryptoUtil';

const LEGACY_HEADER = Buffer.from('DWPTHIST:', 'utf-8');
const LEGACY_KEY = crypto.createHash('sha256').update('DockWatch_History_Key_2026').digest();
const LEGACY_IV = crypto.createHash('md5').update('DockWatch_History_IV_2026').digest();

export function getHistoryFilePath(): string {
  const targetPath = process.env.HISTORY_LOG_PATH || path.join(process.cwd(), 'data', 'history_log.bin');
  try {
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
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

export function readHistoryLogs(): HistoryLogItem[] {
  const filePath = getHistoryFilePath();
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return [];
    const buffer = fs.readFileSync(filePath);
    if (buffer.length === 0) return [];
    const jsonStr = decryptBufferAuto(buffer, 'history', {
      header: LEGACY_HEADER,
      key: LEGACY_KEY,
      iv: LEGACY_IV,
    });
    return JSON.parse(jsonStr || '[]');
  } catch (e) {
    console.error('[HistoryStore] Failed to read history log', e);
    return [];
  }
}

function writeHistoryLogs(logs: HistoryLogItem[]): void {
  const filePath = getHistoryFilePath();
  const retentionDays = Math.max(365, parseInt(process.env.LOG_RETENTION_DAYS || '365', 10) || 365);
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const retained = logs
    .filter((item) => {
      const ts = new Date(item.timestamp).getTime();
      return isNaN(ts) || ts >= cutoff;
    })
    .slice(-50000);

  const binaryBuffer = encryptTextGCM(JSON.stringify(retained), 'history');
  fs.writeFileSync(filePath, binaryBuffer, { mode: 0o600 });
}

export function appendHistoryLog(entry: Omit<HistoryLogItem, 'id' | 'timestamp' | 'prevHash' | 'entryHash'>): HistoryLogItem {
  const currentLogs = readHistoryLogs();
  const lastEntry = currentLogs.length > 0 ? currentLogs[currentLogs.length - 1] : undefined;
  const prevHash = lastEntry?.entryHash || 'GENESIS';

  const baseItem = {
    id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    agentName: entry.agentName || 'System',
    agentUrl: entry.agentUrl || '',
    containerId: entry.containerId,
    containerName: entry.containerName,
    actionType: entry.actionType,
    detail: entry.detail,
    user: entry.user || 'Admin',
    userRealName: entry.userRealName,
    clientIp: normalizeIp(entry.clientIp || '127.0.0.1'),
  };

  const entryHash = computeLogChainHash(prevHash, baseItem);
  const newItem: HistoryLogItem = {
    ...baseItem,
    prevHash,
    entryHash,
  };

  currentLogs.push(newItem);
  writeHistoryLogs(currentLogs);
  return newItem;
}

export function verifyHistoryLogsIntegrity(): {
  valid: boolean;
  totalLogs: number;
  verifiedCount: number;
  legacyUnchainedCount: number;
  tamperedIds: string[];
} {
  const logs = readHistoryLogs();
  const tamperedIds: string[] = [];
  let verifiedCount = 0;
  let legacyUnchainedCount = 0;
  let expectedPrevHash = 'GENESIS';

  for (const item of logs) {
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
