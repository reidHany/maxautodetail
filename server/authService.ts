import crypto from 'crypto';

const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMeNow!';
const adminSessionTtlMs = 1000 * 60 * 30;
const maxLoginAttempts = 5;
const loginWindowMs = 1000 * 60 * 10;

const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();
const adminSessions = new Map<string, number>();

export function getAdminPassword() {
  return adminPassword;
}

export function getAdminTokenTtl() {
  return adminSessionTtlMs;
}

import type { IncomingHttpHeaders } from 'http';

export function getIp(req: { headers: IncomingHttpHeaders; ip?: string }) {
  const header = req.headers['x-forwarded-for'];
  const forwarded = Array.isArray(header) ? header[0] : header;
  return (forwarded as string | undefined)?.split(',')[0].trim() || req.ip || 'unknown';
}

export function recordLoginAttempt(ip: string) {
  const attempt = loginAttempts.get(ip) ?? { count: 0, firstAttempt: Date.now() };
  const now = Date.now();
  if (now - attempt.firstAttempt > loginWindowMs) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    loginAttempts.set(ip, { count: attempt.count + 1, firstAttempt: attempt.firstAttempt });
  }
}

export function canAttemptLogin(ip: string) {
  const attempt = loginAttempts.get(ip);
  if (!attempt) return true;
  if (Date.now() - attempt.firstAttempt > loginWindowMs) {
    loginAttempts.delete(ip);
    return true;
  }
  return attempt.count < maxLoginAttempts;
}

export function createAdminToken() {
  const token = crypto.randomBytes(32).toString('hex');
  adminSessions.set(token, Date.now() + adminSessionTtlMs);
  return token;
}

export function isAdminTokenValid(token?: string) {
  if (!token) return false;
  const expiresAt = adminSessions.get(token);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    adminSessions.delete(token);
    return false;
  }
  return true;
}
