import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { User, UserProfile } from '../types';
import { decryptBufferAuto, encryptTextGCM } from './cryptoUtil';

const LEGACY_HEADER = Buffer.from('DWPTUSER:', 'utf-8');
const LEGACY_KEY = crypto.createHash('sha256').update('DockWatch_User_Key_2026').digest();
const LEGACY_IV = crypto.createHash('md5').update('DockWatch_User_IV_2026').digest();

export const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'root',
  'superuser',
  'sysadmin',
  'system',
  'operator',
  'guest',
  'test',
  'manager',
  'default',
  'dockwatch',
  'ubuntu',
  'centos',
  'postgres',
  'mysql',
  'redis',
]);

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has((username || '').trim().toLowerCase());
}

export function validatePasswordComplexity(
  password: string,
  username?: string
): { valid: boolean; reason?: string } {
  if (!password || password.length < 8) {
    return { valid: false, reason: '비밀번호는 최소 8자 이상이어야 합니다.' };
  }
  let categories = 0;
  if (/[a-z]/.test(password)) categories++;
  if (/[A-Z]/.test(password)) categories++;
  if (/[0-9]/.test(password)) categories++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) categories++;

  if (categories < 3) {
    return {
      valid: false,
      reason: '비밀번호는 영대문자, 영소문자, 숫자, 특수문자 중 3가지 이상을 조합해야 합니다.',
    };
  }

  if (username && username.trim().length >= 3 && password.toLowerCase().includes(username.trim().toLowerCase())) {
    return {
      valid: false,
      reason: '비밀번호에 사용자 아이디를 포함할 수 없습니다.',
    };
  }

  if (/(.)\1{3,}/.test(password)) {
    return {
      valid: false,
      reason: '동일한 문자를 4회 이상 연속해서 사용할 수 없습니다.',
    };
  }

  return { valid: true };
}

export function isPasswordExpired(passwordChangedAt: string): boolean {
  if (!passwordChangedAt) return false;
  const changed = new Date(passwordChangedAt).getTime();
  if (isNaN(changed)) return false;
  const now = Date.now();
  const maxAgeMs = 90 * 24 * 60 * 60 * 1000; // 90 days
  return now - changed > maxAgeMs;
}

const DEFAULT_PBKDF2_ITERATIONS = 100000;

export function hashPassword(
  password: string,
  existingSalt?: string,
  iterations = DEFAULT_PBKDF2_ITERATIONS
): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha256').toString('hex');
  const hash = iterations === 10000 ? derived : `pbkdf2$${iterations}$${derived}`;
  return { hash, salt };
}

export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  if (!storedHash || !salt) return false;

  if (storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$');
    const iterations = parseInt(parts[1], 10);
    const expectedHex = parts[2];
    if (!iterations || !expectedHex) return false;
    const actualHex = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha256').toString('hex');
    if (actualHex.length !== expectedHex.length) return false;
    return crypto.timingSafeEqual(Buffer.from(actualHex, 'hex'), Buffer.from(expectedHex, 'hex'));
  }

  // Legacy 10,000-iteration hash format
  const actualHex = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha256').toString('hex');
  if (actualHex.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(actualHex, 'hex'), Buffer.from(storedHash, 'hex'));
}

function getUsersFilePath(): string {
  const candidates = [
    process.env.USERS_PATH,
    '/app/data/users.bin',
    path.join(process.cwd(), 'data', 'users.bin'),
    path.join(process.cwd(), 'users.bin'),
    path.join(process.cwd(), '..', 'data', 'users.bin'),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const stat = fs.statSync(p);
        if (stat.isFile()) return p;
        if (stat.isDirectory()) {
          const innerFile = path.join(p, 'users.bin');
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
  const targetPath = process.env.USERS_PATH || path.join(defaultDir, 'users.bin');
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

function readUsersRaw(): User[] {
  const filePath = getUsersFilePath();
  try {
    if (!fs.existsSync(filePath)) return [];
    const buffer = fs.readFileSync(filePath);
    if (buffer.length === 0) return [];

    const jsonStr = decryptBufferAuto(buffer, 'users', {
      header: LEGACY_HEADER,
      key: LEGACY_KEY,
      iv: LEGACY_IV,
    });
    return JSON.parse(jsonStr || '[]');
  } catch (e) {
    console.error('[UserStore] Failed to read users', e);
    return [];
  }
}

export function writeUsersRaw(users: User[]): void {
  const filePath = getUsersFilePath();
  const jsonStr = JSON.stringify(users, null, 2);
  const binaryBuffer = encryptTextGCM(jsonStr, 'users');
  fs.writeFileSync(filePath, binaryBuffer, { mode: 0o600 });
}

export function ensureDefaultAdmin(): User[] {
  const users = readUsersRaw();
  // Use non-default initial admin ID ('dw_sec_mgr') unless ADMIN_USER is explicitly provided
  const defaultUser = (process.env.ADMIN_USER || 'dw_sec_mgr').trim();
  const defaultPass = process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWD || 'Admin123!@#';

  const hasAnyAdmin = users.some((u) => u.role === 'admin');
  const targetExists = users.some((u) => u.username.toLowerCase() === defaultUser.toLowerCase());

  if (!hasAnyAdmin && !targetExists) {
    if (isReservedUsername(defaultUser)) {
      console.warn(
        `[SECURITY WARNING] ADMIN_USER='${defaultUser}' is a well-known reserved account name. Set a unique ADMIN_USER in production.`
      );
    }
    const { hash, salt } = hashPassword(defaultPass);
    const now = new Date().toISOString();
    const adminUser: User = {
      id: `user-${Date.now()}-admin`,
      username: defaultUser,
      name: 'System Security Manager',
      email: `${defaultUser}@dockwatch.local`,
      passwordHash: hash,
      salt,
      passwordHistory: [{ hash, salt }],
      role: 'admin',
      createdAt: now,
      passwordChangedAt: now,
      failedLoginAttempts: 0,
      isLocked: false,
      lastLoginAt: now,
    };
    users.push(adminUser);
    writeUsersRaw(users);
  }
  return users;
}

/**
 * Automatically locks accounts that have not logged in within INACTIVE_ACCOUNT_DAYS (default 90 days).
 */
export function checkAndLockInactiveAccounts(): User[] {
  const inactiveDays = Math.max(1, parseInt(process.env.INACTIVE_ACCOUNT_DAYS || '90', 10) || 90);
  const cutoffMs = inactiveDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const users = ensureDefaultAdmin();
  let modified = false;

  const activeAdmins = users.filter((u) => u.role === 'admin' && !u.isLocked);

  for (const user of users) {
    if (user.isLocked) continue;
    // Keep at least one active admin unlocked so the system is never permanently unrecoverable
    if (user.role === 'admin' && activeAdmins.length <= 1) continue;

    const lastRef = user.lastLoginAt || user.createdAt;
    const lastMs = new Date(lastRef).getTime();
    if (!isNaN(lastMs) && now - lastMs > cutoffMs) {
      user.isLocked = true;
      user.lockReason = `INACTIVE_${inactiveDays}_DAYS`;
      user.activeSessionId = undefined;
      modified = true;
    }
  }

  if (modified) {
    writeUsersRaw(users);
  }
  return users;
}

export function getAllUsers(): User[] {
  return checkAndLockInactiveAccounts();
}

export function getUserProfiles(): UserProfile[] {
  const users = checkAndLockInactiveAccounts();
  return users.map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
    passwordChangedAt: u.passwordChangedAt,
    isLocked: u.isLocked,
    lockReason: u.lockReason,
    mustChangePassword: u.mustChangePassword,
    requirePasswordChange: isPasswordExpired(u.passwordChangedAt) || !!u.mustChangePassword,
    failedLoginAttempts: u.failedLoginAttempts,
    lastLoginAt: u.lastLoginAt,
    lastLoginIp: u.lastLoginIp,
    twoFactorEnabled: !!u.twoFactorEnabled,
    allowedIps: u.allowedIps || [],
    isReservedUsername: isReservedUsername(u.username),
  }));
}

export function findUserByUsername(username: string): User | undefined {
  const users = checkAndLockInactiveAccounts();
  return users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
}

export function findUserById(id: string): User | undefined {
  const users = ensureDefaultAdmin();
  return users.find((u) => u.id === id);
}

export function createUser(data: {
  username: string;
  password: string;
  name: string;
  email: string;
  role?: 'admin' | 'user' | 'monitor';
}): { user?: User; error?: string } {
  const users = ensureDefaultAdmin();
  const cleanUsername = data.username.trim();
  const cleanEmail = data.email.trim().toLowerCase();

  if (!cleanUsername || cleanUsername.length < 3 || !/^[a-zA-Z0-9._-]+$/.test(cleanUsername)) {
    return { error: '아이디는 영문, 숫자, ., _, - 조합으로 최소 3자 이상이어야 합니다.' };
  }
  if (isReservedUsername(cleanUsername)) {
    return { error: `'${cleanUsername}'은(는) 보안 정책상 사용할 수 없는 기본/예약 계정명입니다.` };
  }
  if (!data.name || data.name.trim().length < 2) {
    return { error: '실명을 정확히 입력해 주세요 (최소 2자).' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    return { error: '유효한 이메일 주소를 입력해 주세요.' };
  }

  const existing = users.find((u) => u.username.toLowerCase() === cleanUsername.toLowerCase());
  if (existing) {
    return { error: '이미 사용 중인 아이디입니다.' };
  }

  // Enforce 1 person = 1 ID (no duplicate email accounts)
  const existingEmail = users.find((u) => u.email.trim().toLowerCase() === cleanEmail);
  if (existingEmail) {
    return { error: '이미 등록된 이메일 주소입니다. (1인 1계정 원칙)' };
  }

  const complexity = validatePasswordComplexity(data.password, cleanUsername);
  if (!complexity.valid) {
    return { error: complexity.reason };
  }

  const { hash, salt } = hashPassword(data.password);
  const now = new Date().toISOString();
  const newUser: User = {
    id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    username: cleanUsername,
    name: data.name.trim(),
    email: cleanEmail,
    passwordHash: hash,
    salt,
    passwordHistory: [{ hash, salt }],
    role: data.role || 'user',
    createdAt: now,
    passwordChangedAt: now,
    failedLoginAttempts: 0,
    isLocked: false,
  };

  users.push(newUser);
  writeUsersRaw(users);
  return { user: newUser };
}

export function recordLoginAttempt(
  username: string,
  isSuccess: boolean,
  clientIp?: string
): { user?: User; lockedNow?: boolean; expiredPassword?: boolean } {
  const users = ensureDefaultAdmin();
  const user = users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
  if (!user) return {};

  const now = new Date().toISOString();
  let lockedNow = false;

  if (isSuccess) {
    user.failedLoginAttempts = 0;
    user.lastLoginAt = now;
    user.lastActivityAt = now;
    if (clientIp) user.lastLoginIp = clientIp;
  } else {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= 5) {
      user.isLocked = true;
      user.lockReason = 'FAILED_ATTEMPTS_5';
      user.activeSessionId = undefined;
      lockedNow = true;
    }
  }

  writeUsersRaw(users);
  return {
    user,
    lockedNow,
    expiredPassword: isPasswordExpired(user.passwordChangedAt) || !!user.mustChangePassword,
  };
}

export function setUserActiveSession(
  userId: string,
  sessionId: string,
  clientIp: string
): { previousIp?: string; hadActiveSession: boolean } {
  const users = ensureDefaultAdmin();
  const user = users.find((u) => u.id === userId);
  if (!user) return { hadActiveSession: false };

  const hadActiveSession = !!user.activeSessionId && user.activeSessionId !== sessionId;
  const previousIp = user.activeSessionIp;

  user.activeSessionId = sessionId;
  user.activeSessionIp = clientIp;
  user.lastActivityAt = new Date().toISOString();
  writeUsersRaw(users);

  return { hadActiveSession, previousIp };
}

export function clearUserActiveSession(userId: string, onlyIfSessionId?: string): void {
  const users = ensureDefaultAdmin();
  const user = users.find((u) => u.id === userId);
  if (!user) return;
  if (onlyIfSessionId && user.activeSessionId !== onlyIfSessionId) return;

  user.activeSessionId = undefined;
  user.activeSessionIp = undefined;
  user.reauthVerifiedAt = undefined;
  writeUsersRaw(users);
}

export function touchUserActivity(userId: string, sessionId: string): void {
  const users = ensureDefaultAdmin();
  const user = users.find((u) => u.id === userId);
  if (!user || user.activeSessionId !== sessionId) return;

  const now = Date.now();
  const last = user.lastActivityAt ? new Date(user.lastActivityAt).getTime() : 0;
  // Avoid redundant disk writes more frequently than every 15 seconds
  if (now - last < 15000) return;

  user.lastActivityAt = new Date(now).toISOString();
  writeUsersRaw(users);
}

export function markReauthVerified(userId: string): void {
  const users = ensureDefaultAdmin();
  const user = users.find((u) => u.id === userId);
  if (!user) return;
  user.reauthVerifiedAt = new Date().toISOString();
  writeUsersRaw(users);
}

export function isReauthRecentlyVerified(user: User, maxAgeMs = 5 * 60 * 1000): boolean {
  if (!user.reauthVerifiedAt) return false;
  const ts = new Date(user.reauthVerifiedAt).getTime();
  if (isNaN(ts)) return false;
  return Date.now() - ts <= maxAgeMs;
}

export function updateUserPassword(userId: string, newPassword: string): { success: boolean; error?: string } {
  const users = ensureDefaultAdmin();
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return { success: false, error: '사용자를 찾을 수 없습니다.' };
  }

  const complexity = validatePasswordComplexity(newPassword, user.username);
  if (!complexity.valid) {
    return { success: false, error: complexity.reason };
  }

  if (verifyPassword(newPassword, user.passwordHash, user.salt)) {
    return { success: false, error: '새 비밀번호는 현재 비밀번호와 달라야 합니다.' };
  }

  const history = user.passwordHistory || [];
  for (const prev of history) {
    if (verifyPassword(newPassword, prev.hash, prev.salt)) {
      return { success: false, error: '최근 사용한 비밀번호(3회 이내)는 재사용할 수 없습니다.' };
    }
  }

  const { hash, salt } = hashPassword(newPassword);
  user.passwordHash = hash;
  user.salt = salt;
  user.passwordHistory = [{ hash, salt }, ...history].slice(0, 3);
  user.passwordChangedAt = new Date().toISOString();
  user.failedLoginAttempts = 0;
  user.isLocked = false;
  user.lockReason = undefined;
  user.mustChangePassword = false;

  writeUsersRaw(users);
  return { success: true };
}

export function updateUserRole(userId: string, newRole: 'admin' | 'user' | 'monitor'): { success: boolean; error?: string } {
  const users = ensureDefaultAdmin();
  const user = users.find((u) => u.id === userId);
  if (!user) return { success: false, error: 'User not found' };

  if (user.role === 'admin' && newRole !== 'admin') {
    const adminCount = users.filter((u) => u.role === 'admin').length;
    if (adminCount <= 1) {
      return { success: false, error: '최소 1명의 관리자 계정은 유지되어야 합니다.' };
    }
  }

  user.role = newRole;
  writeUsersRaw(users);
  return { success: true };
}

export function unlockUser(
  userId: string,
  tempPassword?: string
): { success: boolean; error?: string } {
  const users = ensureDefaultAdmin();
  const user = users.find((u) => u.id === userId);
  if (!user) return { success: false, error: 'User not found' };

  if (tempPassword) {
    const complexity = validatePasswordComplexity(tempPassword, user.username);
    if (!complexity.valid) {
      return { success: false, error: complexity.reason };
    }
    const { hash, salt } = hashPassword(tempPassword);
    user.passwordHash = hash;
    user.salt = salt;
    user.passwordChangedAt = new Date().toISOString();
    user.mustChangePassword = true;
  }

  user.isLocked = false;
  user.lockReason = undefined;
  user.failedLoginAttempts = 0;
  user.lastLoginAt = new Date().toISOString();
  writeUsersRaw(users);
  return { success: true };
}

export function updateUserAllowedIps(userId: string, allowedIps: string[]): { success: boolean; error?: string } {
  const users = ensureDefaultAdmin();
  const user = users.find((u) => u.id === userId);
  if (!user) return { success: false, error: 'User not found' };

  user.allowedIps = allowedIps.map((ip) => ip.trim()).filter(Boolean);
  writeUsersRaw(users);
  return { success: true };
}

export function setUserTwoFactor(
  userId: string,
  enabled: boolean,
  secret?: string
): { success: boolean; error?: string } {
  const users = ensureDefaultAdmin();
  const user = users.find((u) => u.id === userId);
  if (!user) return { success: false, error: 'User not found' };

  user.twoFactorEnabled = enabled;
  if (enabled && secret) {
    user.twoFactorSecret = secret;
  } else if (!enabled) {
    user.twoFactorSecret = undefined;
  }
  writeUsersRaw(users);
  return { success: true };
}

export function deleteUser(userId: string): { success: boolean; error?: string } {
  let users = ensureDefaultAdmin();
  const user = users.find((u) => u.id === userId);
  if (!user) return { success: false, error: 'User not found' };

  if (user.role === 'admin') {
    const adminCount = users.filter((u) => u.role === 'admin').length;
    if (adminCount <= 1) {
      return { success: false, error: '최소 1명의 관리자 계정은 유지되어야 합니다.' };
    }
  }

  users = users.filter((u) => u.id !== userId);
  writeUsersRaw(users);
  return { success: true };
}
