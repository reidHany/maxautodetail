"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminPassword = getAdminPassword;
exports.getAdminTokenTtl = getAdminTokenTtl;
exports.getIp = getIp;
exports.recordLoginAttempt = recordLoginAttempt;
exports.canAttemptLogin = canAttemptLogin;
exports.createAdminToken = createAdminToken;
exports.isAdminTokenValid = isAdminTokenValid;
const crypto_1 = __importDefault(require("crypto"));
const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMeNow!';
const adminSessionTtlMs = 1000 * 60 * 30;
const maxLoginAttempts = 5;
const loginWindowMs = 1000 * 60 * 10;
const loginAttempts = new Map();
const adminSessions = new Map();
function getAdminPassword() {
    return adminPassword;
}
function getAdminTokenTtl() {
    return adminSessionTtlMs;
}
function getIp(req) {
    const header = req.headers['x-forwarded-for'];
    const forwarded = Array.isArray(header) ? header[0] : header;
    return forwarded?.split(',')[0].trim() || req.ip || 'unknown';
}
function recordLoginAttempt(ip) {
    const attempt = loginAttempts.get(ip) ?? { count: 0, firstAttempt: Date.now() };
    const now = Date.now();
    if (now - attempt.firstAttempt > loginWindowMs) {
        loginAttempts.set(ip, { count: 1, firstAttempt: now });
    }
    else {
        loginAttempts.set(ip, { count: attempt.count + 1, firstAttempt: attempt.firstAttempt });
    }
}
function canAttemptLogin(ip) {
    const attempt = loginAttempts.get(ip);
    if (!attempt)
        return true;
    if (Date.now() - attempt.firstAttempt > loginWindowMs) {
        loginAttempts.delete(ip);
        return true;
    }
    return attempt.count < maxLoginAttempts;
}
function createAdminToken() {
    const token = crypto_1.default.randomBytes(32).toString('hex');
    adminSessions.set(token, Date.now() + adminSessionTtlMs);
    return token;
}
function isAdminTokenValid(token) {
    if (!token)
        return false;
    const expiresAt = adminSessions.get(token);
    if (!expiresAt)
        return false;
    if (Date.now() > expiresAt) {
        adminSessions.delete(token);
        return false;
    }
    return true;
}
