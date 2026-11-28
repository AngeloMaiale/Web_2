'use strict';
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');
const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'newPassword',
  'token',
  'authorization',
  'secret',
]);

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function sanitize(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sanitize);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEYS.has(k) || SENSITIVE_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : sanitize(v);
    }
    return out;
  }
  return value;
}

function writeLog(level, message, meta = null) {
  ensureLogDir();
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
  };
  if (meta !== null && meta !== undefined) {
    entry.meta = sanitize(meta);
  }

  const line = JSON.stringify(entry) + '\n';
  if (level === 'ERROR') {
    console.error(`[${entry.ts}] [${level}] ${message}`, entry.meta || '');
  } else {
    console.log(`[${entry.ts}] [${level}] ${message}`, entry.meta || '');
  }

  try {
    fs.appendFileSync(path.join(LOG_DIR, 'app.log'), line, 'utf8');
    if (level === 'SECURITY') {
      fs.appendFileSync(path.join(LOG_DIR, 'security.log'), line, 'utf8');
    } else if (level === 'ERROR') {
      fs.appendFileSync(path.join(LOG_DIR, 'error.log'), line, 'utf8');
    }
  } catch (err) {
    console.error('[Logger] No se pudo escribir en archivo de log:', err.message);
  }
}

const logger = {
  info: (msg, meta) => writeLog('INFO', msg, meta),
  warn: (msg, meta) => writeLog('WARN', msg, meta),
  error: (msg, meta) => writeLog('ERROR', msg, meta),
  security: (msg, meta) => writeLog('SECURITY', msg, meta),
  httpLogger(req, res, next) {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      writeLog('INFO', 'HTTP Request', {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        ms: Number(durationMs.toFixed(2)),
        ip: req.ip || req.socket?.remoteAddress || null,
        user: req.sessionUser?.username || null,
      });
    });
    next();
  },
};

module.exports = logger;
