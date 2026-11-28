'use strict';
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'nomina-jwt-secreto-dev';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

const revokedTokens = new Map();

function cleanupRevoked() {
  const now = Date.now();
  for (const [jti, expMs] of revokedTokens.entries()) {
    if (expMs <= now) {
      revokedTokens.delete(jti);
    }
  }
}

function extractToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function buildPayload(userData, activeProfileCode = null) {
  const profiles = Array.isArray(userData.profiles) ? userData.profiles : [];
  let activeProfile = null;
  if (activeProfileCode) {
    activeProfile = profiles.find((p) => p.role === activeProfileCode) || null;
  }
  if (!activeProfile) {
    activeProfile = userData.activeProfile || profiles[0] || null;
  }

  return {
    userId: userData.userId,
    username: userData.username,
    profiles,
    activeProfile,
    employeeId: activeProfile?.employeeId ?? userData.employeeId ?? null,
    jti: crypto.randomUUID(),
  };
}

function createToken(userData, activeProfileCode = null) {
  const payload = buildPayload(userData, activeProfileCode);
  const token = jwt.sign(payload, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: JWT_EXPIRES_IN,
  });
  const decoded = jwt.decode(token);
  const session = {
    userId: payload.userId,
    username: payload.username,
    profiles: payload.profiles,
    activeProfile: payload.activeProfile,
    employeeId: payload.employeeId,
    expiresAt: decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null,
  };
  return { token, session, jti: payload.jti };
}

function verifyToken(token) {
  if (!token) return null;
  cleanupRevoked();
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (decoded.jti && revokedTokens.has(decoded.jti)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function getSession(req) {
  const token = extractToken(req);
  const decoded = verifyToken(token);
  if (!decoded) return null;
  return {
    userId: decoded.userId,
    username: decoded.username,
    profiles: decoded.profiles || [],
    activeProfile: decoded.activeProfile || null,
    employeeId: decoded.employeeId ?? null,
    jti: decoded.jti,
    exp: decoded.exp,
    expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null,
  };
}

function hasSession(req) {
  return getSession(req) !== null;
}

function revoke(req) {
  const token = extractToken(req);
  const decoded = verifyToken(token);
  if (!decoded || !decoded.jti) return false;
  const expMs = decoded.exp ? decoded.exp * 1000 : Date.now() + 8 * 60 * 60 * 1000;
  revokedTokens.set(decoded.jti, expMs);
  return true;
}

function switchProfile(req, targetRoleCode) {
  const current = getSession(req);
  if (!current) return null;
  const target = current.profiles.find((p) => p.role === targetRoleCode);
  if (!target) return { error: 'El perfil solicitado no pertenece al usuario' };

  revoke(req);
  return createToken(current, targetRoleCode);
}

module.exports = {
  createToken,
  extractToken,
  verifyToken,
  getSession,
  hasSession,
  revoke,
  switchProfile,
};
