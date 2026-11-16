import crypto from 'crypto';
import { User, UserRole } from '../types';
import {
  clearUserActiveSession,
  findUserById,
  findUserByUsername,
  isPasswordExpired,
  touchUserActivity,
} from './userStore';
import { deriveSubKey, isIpAllowed } from './cryptoUtil';
import { addSystemLog, getClientIp } from './systemLogStore';

export interface SessionData {
  userId: string;
  username: string;
  name: string;
  role: UserRole;
  sessionId: string;
  issuedAt: number;
}

export function getIdleTimeoutMs(): number {
  const mins = parseInt(process.env.SESSION_IDLE_TIMEOUT_MINUTES || '10', 10);
  const validMins = !isNaN(mins) && mins > 0 ? mins : 10;
  return validMins * 60 * 1000;
}

export function createSessionToken(user: User, sessionId: string): string {
  const payload: SessionData = {
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    sessionId,
    issuedAt: Date.now(),
  };

  const jsonStr = JSON.stringify(payload);
  const key = deriveSubKey('session-token');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(jsonStr, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64url');
}

export function parseSessionToken(token: string): SessionData | null {
  if (!token) return null;
  try {
    const raw = Buffer.from(token, 'base64url');
    if (raw.length <= 28) return null;
    const iv = raw.subarray(0, 12);
    const authTag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);

    const key = deriveSubKey('session-token');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const payload: SessionData = JSON.parse(decrypted.toString('utf-8'));

    const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - payload.issuedAt > maxAgeMs) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export type SessionErrorReason =
  | 'UNAUTHENTICATED'
  | 'LOCKED'
  | 'CONCURRENT_SESSION'
  | 'IDLE_TIMEOUT'
  | 'IP_DENIED'
  | 'PASSWORD_EXPIRED';

export function getGlobalAllowedIps(): string[] {
  const raw = process.env.ALLOWED_IPS || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getSessionUser(
  request: Request,
  options?: { isBackgroundPoll?: boolean; allowExpiredPassword?: boolean }
): {
  session: SessionData | null;
  user?: User;
  errorReason?: SessionErrorReason;
  idleRemainingSeconds?: number;
} {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/fakeportainer_session=([^;]+)/);
  let token = match ? match[1] : '';

  if (!token) {
    const authHeader = request.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  if (!token) {
    return { session: null, errorReason: 'UNAUTHENTICATED' };
  }

  const session = parseSessionToken(token);
  if (!session) {
    return { session: null, errorReason: 'UNAUTHENTICATED' };
  }

  const user = findUserById(session.userId) || findUserByUsername(session.username);
  if (!user) {
    return { session: null, errorReason: 'UNAUTHENTICATED' };
  }

  if (user.isLocked) {
    return { session: null, errorReason: 'LOCKED' };
  }

  // Enforce Single Active Session per User (항목 1, 14)
  if (!user.activeSessionId || user.activeSessionId !== session.sessionId) {
    return { session: null, errorReason: 'CONCURRENT_SESSION' };
  }

  const clientIp = getClientIp(request);

  // Enforce Global & Per-User IP Whitelist (항목 11, 17)
  const globalAllowed = getGlobalAllowedIps();
  if (globalAllowed.length > 0 && !isIpAllowed(clientIp, globalAllowed)) {
    addSystemLog({
      clientIp,
      user: user.username,
      userRealName: user.name,
      category: 'ACCESS_DENIED',
      level: 'ERROR',
      action: 'GLOBAL_IP_DENIED',
      detail: `허용되지 않은 전역 IP(${clientIp})에서 세션 접근 차단`,
    });
    return { session: null, errorReason: 'IP_DENIED' };
  }
  if (user.allowedIps && user.allowedIps.length > 0 && !isIpAllowed(clientIp, user.allowedIps)) {
    addSystemLog({
      clientIp,
      user: user.username,
      userRealName: user.name,
      category: 'ACCESS_DENIED',
      level: 'ERROR',
      action: 'USER_IP_WHITELIST_DENIED',
      detail: `계정 '${user.username}'의 허용 IP 목록에 없는 IP(${clientIp}) 접근 차단`,
    });
    return { session: null, errorReason: 'IP_DENIED' };
  }

  // Enforce 10-minute Idle Timeout (항목 13)
  const idleTimeoutMs = getIdleTimeoutMs();
  const lastActivityMs = user.lastActivityAt
    ? new Date(user.lastActivityAt).getTime()
    : session.issuedAt;
  const elapsedMs = Date.now() - lastActivityMs;

  if (elapsedMs > idleTimeoutMs) {
    clearUserActiveSession(user.id, session.sessionId);
    addSystemLog({
      clientIp,
      user: user.username,
      userRealName: user.name,
      category: 'EVENT',
      level: 'INFO',
      action: 'SESSION_IDLE_TIMEOUT',
      detail: `사용자 '${user.username}' (${user.name}) ${Math.round(idleTimeoutMs / 60000)}분 이상 미활동으로 세션 자동 종료 (IP: ${clientIp})`,
    });
    return { session: null, errorReason: 'IDLE_TIMEOUT', idleRemainingSeconds: 0 };
  }

  const isBgPoll =
    options?.isBackgroundPoll ?? request.headers.get('x-background-poll') === 'true';

  if (!isBgPoll) {
    touchUserActivity(user.id, session.sessionId);
  }

  if (!options?.allowExpiredPassword && (isPasswordExpired(user.passwordChangedAt) || user.mustChangePassword)) {
    return { session: null, user, errorReason: 'PASSWORD_EXPIRED' };
  }

  const idleRemainingSeconds = Math.max(0, Math.floor((idleTimeoutMs - elapsedMs) / 1000));
  return { session, user, idleRemainingSeconds };
}
