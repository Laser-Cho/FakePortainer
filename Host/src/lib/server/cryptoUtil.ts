import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const GCM_HEADER = Buffer.from('DWPTGCM1:', 'utf-8');

let cachedMasterKey: Buffer | null = null;

function resolveDataDir(): string {
  const envPaths = [
    process.env.USERS_PATH,
    process.env.SYSTEM_LOG_PATH,
    process.env.HISTORY_LOG_PATH,
    process.env.WATCH_LIST_PATH,
  ].filter(Boolean) as string[];

  if (envPaths.length > 0) {
    return path.dirname(envPaths[0]);
  }
  if (fs.existsSync('/app/data')) {
    return '/app/data';
  }
  return path.join(process.cwd(), 'data');
}

/**
 * Loads or generates a 256-bit master encryption key without hardcoding secrets in source code.
 * Priority: DATA_ENCRYPTION_KEY env -> /app/data/.master.key (auto-generated with 0600 mode).
 */
export function getMasterKey(): Buffer {
  if (cachedMasterKey) return cachedMasterKey;

  const envKey = process.env.DATA_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (envKey && envKey.trim().length > 0) {
    cachedMasterKey = crypto.createHash('sha256').update(envKey.trim()).digest();
    return cachedMasterKey;
  }

  const dataDir = resolveDataDir();
  const keyFilePath = process.env.MASTER_KEY_PATH || path.join(dataDir, '.master.key');

  try {
    if (fs.existsSync(keyFilePath)) {
      const hex = fs.readFileSync(keyFilePath, 'utf-8').trim();
      if (/^[a-fA-F0-9]{64}$/.test(hex)) {
        cachedMasterKey = Buffer.from(hex, 'hex');
        return cachedMasterKey;
      }
    }

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const generated = crypto.randomBytes(32);
    fs.writeFileSync(keyFilePath, generated.toString('hex'), { mode: 0o600 });
    try {
      fs.chmodSync(keyFilePath, 0o600);
    } catch {
      // Ignore chmod error on Windows/mounted volumes that disallow chmod
    }
    cachedMasterKey = generated;
    return cachedMasterKey;
  } catch (err) {
    // Ephemeral fallback if filesystem is read-only
    cachedMasterKey = crypto.randomBytes(32);
    return cachedMasterKey;
  }
}

export function deriveSubKey(purpose: string): Buffer {
  const master = getMasterKey();
  return crypto.createHmac('sha256', master).update(`dockwatch-purpose:${purpose}`).digest();
}

/**
 * Encrypts UTF-8 text using AES-256-GCM with a random 12-byte IV per encryption.
 */
export function encryptTextGCM(plaintext: string, purpose: string): Buffer {
  const key = deriveSubKey(purpose);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16 bytes
  return Buffer.concat([GCM_HEADER, iv, authTag, encrypted]);
}

/**
 * Decrypts AES-256-GCM payloads or falls back to legacy AES-256-CBC / plaintext formats.
 */
export function decryptBufferAuto(
  buffer: Buffer,
  purpose: string,
  legacy?: { header: Buffer; key: Buffer; iv: Buffer }
): string {
  if (!buffer || buffer.length === 0) return '';

  // Modern AES-256-GCM format
  if (buffer.length > GCM_HEADER.length + 28 && buffer.subarray(0, GCM_HEADER.length).equals(GCM_HEADER)) {
    const offset = GCM_HEADER.length;
    const iv = buffer.subarray(offset, offset + 12);
    const authTag = buffer.subarray(offset + 12, offset + 28);
    const ciphertext = buffer.subarray(offset + 28);

    const key = deriveSubKey(purpose);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf-8');
  }

  // Legacy AES-256-CBC format fallback
  if (legacy && buffer.length >= legacy.header.length && buffer.subarray(0, legacy.header.length).equals(legacy.header)) {
    const encryptedData = buffer.subarray(legacy.header.length);
    const decipher = crypto.createDecipheriv('aes-256-cbc', legacy.key, legacy.iv);
    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    return decrypted.toString('utf-8');
  }

  return buffer.toString('utf-8');
}

/**
 * Computes a tamper-evident HMAC-SHA256 chain hash for log entries.
 */
export function computeLogChainHash(prevHash: string, payloadWithoutHash: Record<string, unknown>): string {
  const key = deriveSubKey('log-integrity-chain');
  const keys = Object.keys(payloadWithoutHash).sort();
  const canonical: Record<string, unknown> = {};
  for (const k of keys) {
    if (payloadWithoutHash[k] !== undefined) {
      canonical[k] = payloadWithoutHash[k];
    }
  }
  return crypto
    .createHmac('sha256', key)
    .update(`${prevHash}|${JSON.stringify(canonical)}`)
    .digest('hex');
}

// ---------------- TOTP (RFC 6238) ----------------

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(base32: string): Buffer {
  const clean = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function generateTotpCode(secretBase32: string, counter: number): string {
  const key = base32Decode(secretBase32);
  const buf = Buffer.alloc(8);
  let tmp = counter;
  for (let i = 7; i >= 0; i--) {
    buf[i] = tmp & 0xff;
    tmp = Math.floor(tmp / 256);
  }
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 1000000).toString().padStart(6, '0');
}

export function verifyTotpToken(secretBase32: string, token: string, window = 1): boolean {
  const cleanToken = (token || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanToken)) return false;
  const currentCounter = Math.floor(Date.now() / 1000 / 30);
  for (let offset = -window; offset <= window; offset++) {
    const expected = generateTotpCode(secretBase32, currentCounter + offset);
    if (crypto.timingSafeEqual(Buffer.from(cleanToken), Buffer.from(expected))) {
      return true;
    }
  }
  return false;
}

export function buildOtpAuthUri(username: string, secret: string, issuer = 'DockWatch'): string {
  const label = encodeURIComponent(`${issuer}:${username}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// ---------------- IP / CIDR Whitelist Matching ----------------

export function normalizeIp(ip: string): string {
  let clean = (ip || '').trim();
  if (clean.startsWith('::ffff:')) {
    clean = clean.substring(7);
  }
  if (clean === '::1') return '127.0.0.1';
  return clean;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let num = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const n = Number(part);
    if (n < 0 || n > 255) return null;
    num = (num << 8) | n;
  }
  return num >>> 0;
}

export function isIpAllowed(clientIp: string, allowedList?: string[]): boolean {
  if (!allowedList || allowedList.length === 0) return true;
  const normClient = normalizeIp(clientIp);
  if (!normClient) return false;

  for (const rawRule of allowedList) {
    const rule = normalizeIp(rawRule);
    if (!rule) continue;
    if (rule === '*' || rule === normClient) return true;

    if (rule.includes('/')) {
      const [cidrIp, prefixStr] = rule.split('/');
      const prefix = Number(prefixStr);
      const clientInt = ipv4ToInt(normClient);
      const netInt = ipv4ToInt(cidrIp);
      if (clientInt !== null && netInt !== null && Number.isInteger(prefix) && prefix >= 0 && prefix <= 32) {
        const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
        if ((clientInt & mask) === (netInt & mask)) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Mints a short-lived HS256 JWT compatible with jsonwebtoken.verify() on the Agent.
 */
export function signAgentJwt(secret: string, payload: Record<string, unknown>, expiresInSec = 300): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSec })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}
