import crypto from 'crypto';
import { User, UserRole } from '../types';
import { findUserById, findUserByUsername } from './userStore';

const SESSION_SECRET = crypto.createHash('sha256').update(process.env.SESSION_SECRET || 'DockWatch_Session_Key_2026').digest();
const SESSION_IV = crypto.createHash('md5').update('DockWatch_Session_IV_2026').digest();

export interface SessionData {
  userId: string;
  username: string;
  name: string;
  role: UserRole;
  issuedAt: number;
}

export function createSessionToken(user: User): string {
  const payload: SessionData = {
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    issuedAt: Date.now(),
  };

  const jsonStr = JSON.stringify(payload);
  const cipher = crypto.createCipheriv('aes-256-cbc', SESSION_SECRET, SESSION_IV);
  const encrypted = Buffer.concat([cipher.update(jsonStr, 'utf-8'), cipher.final()]);
  return encrypted.toString('base64url');
}

export function parseSessionToken(token: string): SessionData | null {
  if (!token) return null;
  try {
    const encrypted = Buffer.from(token, 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-cbc', SESSION_SECRET, SESSION_IV);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const payload: SessionData = JSON.parse(decrypted.toString('utf-8'));

    // Optional 7-day expiration
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - payload.issuedAt > maxAgeMs) {
      return null;
    }

    return payload;
  } catch (e) {
    return null;
  }
}

export function getSessionUser(request: Request): { session: SessionData | null; user?: User } {
  // Check Cookie
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/fakeportainer_session=([^;]+)/);
  let token = match ? match[1] : '';

  // Check Bearer token
  if (!token) {
    const authHeader = request.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  if (!token) {
    return { session: null };
  }

  const session = parseSessionToken(token);
  if (!session) {
    return { session: null };
  }

  const user = findUserById(session.userId) || findUserByUsername(session.username);
  return { session, user };
}
