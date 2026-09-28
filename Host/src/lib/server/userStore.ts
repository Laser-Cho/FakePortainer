import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { User, UserProfile } from '../types';

const MAGIC_HEADER = Buffer.from('DWPTUSER:', 'utf-8');
const SECRET_KEY = crypto.createHash('sha256').update('DockWatch_User_Key_2026').digest();
const SECRET_IV = crypto.createHash('md5').update('DockWatch_User_IV_2026').digest();

export function validatePasswordComplexity(password: string): { valid: boolean; reason?: string } {
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

export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha256').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const { hash: calculated } = hashPassword(password, salt);
  return calculated === hash;
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

  // Fallback to data dir
  const defaultDir = path.join(process.cwd(), 'data');
  try {
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }
  } catch (e) {}
  const targetPath = process.env.USERS_PATH || path.join(defaultDir, 'users.bin');
  try {
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
    console.error('[UserStore] Failed to read users', e);
    return [];
  }
}

function writeUsersRaw(users: User[]): void {
  const filePath = getUsersFilePath();
  const jsonStr = JSON.stringify(users, null, 2);
  const cipher = crypto.createCipheriv('aes-256-cbc', SECRET_KEY, SECRET_IV);
  const encrypted = Buffer.concat([cipher.update(jsonStr, 'utf-8'), cipher.final()]);
  const binaryBuffer = Buffer.concat([MAGIC_HEADER, encrypted]);
  fs.writeFileSync(filePath, binaryBuffer);
}

// Ensure default admin account exists
export function ensureDefaultAdmin(): User[] {
  let users = readUsersRaw();
  const defaultUser = process.env.ADMIN_USER || 'admin';
  const defaultPass = process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWD || 'Admin123!@#';

  const adminExists = users.some((u) => u.username.toLowerCase() === defaultUser.toLowerCase());
  if (!adminExists) {
    const { hash, salt } = hashPassword(defaultPass);
    const now = new Date().toISOString();
    const adminUser: User = {
      id: `user-${Date.now()}-admin`,
      username: defaultUser,
      name: 'System Administrator',
      email: `${defaultUser}@dockwatch.local`,
      passwordHash: hash,
      salt,
      role: 'admin',
      createdAt: now,
      passwordChangedAt: now,
      failedLoginAttempts: 0,
      isLocked: false,
    };
    users.push(adminUser);
    writeUsersRaw(users);
  }
  return users;
}

export function getAllUsers(): User[] {
  return ensureDefaultAdmin();
}

export function getUserProfiles(): UserProfile[] {
  const users = ensureDefaultAdmin();
  return users.map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
    passwordChangedAt: u.passwordChangedAt,
    isLocked: u.isLocked,
    requirePasswordChange: isPasswordExpired(u.passwordChangedAt),
  }));
}

export function findUserByUsername(username: string): User | undefined {
  const users = ensureDefaultAdmin();
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
  role?: 'admin' | 'user';
}): { user?: User; error?: string } {
  const users = ensureDefaultAdmin();
  const cleanUsername = data.username.trim();

  if (!cleanUsername || cleanUsername.length < 3) {
    return { error: '아이디는 최소 3자 이상이어야 합니다.' };
  }
  if (!data.name || data.name.trim().length < 2) {
    return { error: '실명을 정확히 입력해 주세요 (최소 2자).' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !emailRegex.test(data.email.trim())) {
    return { error: '유효한 이메일 주소를 입력해 주세요.' };
  }

  const existing = users.find((u) => u.username.toLowerCase() === cleanUsername.toLowerCase());
  if (existing) {
    return { error: '이미 사용 중인 아이디입니다.' };
  }

  const complexity = validatePasswordComplexity(data.password);
  if (!complexity.valid) {
    return { error: complexity.reason };
  }

  const { hash, salt } = hashPassword(data.password);
  const now = new Date().toISOString();
  const newUser: User = {
    id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    username: cleanUsername,
    name: data.name.trim(),
    email: data.email.trim(),
    passwordHash: hash,
    salt,
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
    if (clientIp) user.lastLoginIp = clientIp;
  } else {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= 5) {
      user.isLocked = true;
      lockedNow = true;
    }
  }

  writeUsersRaw(users);
  return {
    user,
    lockedNow,
    expiredPassword: isPasswordExpired(user.passwordChangedAt),
  };
}

export function updateUserPassword(userId: string, newPassword: string): { success: boolean; error?: string } {
  const complexity = validatePasswordComplexity(newPassword);
  if (!complexity.valid) {
    return { success: false, error: complexity.reason };
  }

  const users = ensureDefaultAdmin();
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return { success: false, error: '사용자를 찾을 수 없습니다.' };
  }

  const { hash, salt } = hashPassword(newPassword);
  user.passwordHash = hash;
  user.salt = salt;
  user.passwordChangedAt = new Date().toISOString();
  user.failedLoginAttempts = 0;
  user.isLocked = false;

  writeUsersRaw(users);
  return { success: true };
}

export function updateUserRole(userId: string, newRole: 'admin' | 'user'): { success: boolean; error?: string } {
  const users = ensureDefaultAdmin();
  const user = users.find((u) => u.id === userId);
  if (!user) return { success: false, error: 'User not found' };

  user.role = newRole;
  writeUsersRaw(users);
  return { success: true };
}

export function unlockUser(userId: string): { success: boolean; error?: string } {
  const users = ensureDefaultAdmin();
  const user = users.find((u) => u.id === userId);
  if (!user) return { success: false, error: 'User not found' };

  user.isLocked = false;
  user.failedLoginAttempts = 0;
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
