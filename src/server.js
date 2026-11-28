'use strict';
require('dotenv').config();

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./subsystems/auth/authRoutes');
const jwtSession = require('./subsystems/auth/JwtSession');
const security = require('./subsystems/seguridad/Security');
const logger = require('./core/Logger');
const { AuthError, ForbiddenError, ValidationError, okResponse, translateError } = require('./core/Errors');

const PORT = Number(process.env.PORT) || 3000;
const HTTPS_PORT = Number(process.env.HTTPS_PORT) || 3443;
const ENABLE_HTTPS = String(process.env.ENABLE_HTTPS || '').toLowerCase() === 'true';

const app = express();

// Configuración CORS
const allowedOrigins = (process.env.CORS_ORIGIN || `http://localhost:${PORT}`)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new ForbiddenError('Origen no permitido por CORS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Authorization'],
}));

app.use(express.json());

// Adjunta sesión si viene JWT válido en cabecera para trazabilidad en httpLogger
app.use((req, _res, next) => {
  req.sessionUser = jwtSession.getSession(req);
  next();
});
app.use(logger.httpLogger);

app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/api/auth', authRoutes);

// Único endpoint centralizado de procesos (PDF 1)
app.post('/api/toProcess', async (req, res) => {
  try {
    // 1. Validar sesión JWT en cabecera
    const session = req.sessionUser || jwtSession.getSession(req);
    if (!session) {
      logger.security('Acceso denegado en /api/toProcess: sin JWT válido', { ip: req.ip });
      throw new AuthError('Debe iniciar sesión');
    }

    // 2. Validar estructura básica de la transacción
    const { tx, params } = req.body || {};
    const txNum = Number(tx);
    if (!Number.isInteger(txNum) || txNum <= 0) {
      throw new ValidationError('El campo tx debe ser un número entero positivo');
    }

    // 3. Validar permiso en caché Map
    const profilesToCheck = session.activeProfile ? [session.activeProfile] : session.profiles;
    if (!security.hasPermission(profilesToCheck, txNum)) {
      logger.security('Acceso prohibido en /api/toProcess (403)', {
        userId: session.userId,
        username: session.username,
        activeProfile: session.activeProfile?.role || null,
        tx: txNum,
        ip: req.ip,
      });
      throw new ForbiddenError('No tiene permiso para ejecutar esta acción');
    }

    // 4. Ejecutar Business Object pasando el contexto autenticado
    const context = {
      userId: session.userId,
      username: session.username,
      activeProfile: session.activeProfile,
      profiles: session.profiles,
      employeeId: session.employeeId,
      ip: req.ip,
    };

    const data = await security.executeMethod({ tx: txNum, params }, context);
    res.json(okResponse(data));
  } catch (err) {
    const { status, body } = translateError(err);
    if (status >= 500) {
      logger.error('Error en /api/toProcess', {
        tx: req.body?.tx ?? null,
        name: err.name,
        code: err.code || null,
        error: err.message || String(err),
        causes: Array.isArray(err.errors) ? err.errors.map((e) => e.message || e.code) : undefined,
        stack: err.stack,
      });
    }
    res.status(status).json(body);
  }
});

// Manejador global de errores (incluye errores CORS o JSON malformado)
app.use((err, _req, res, _next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', message: 'JSON inválido en la petición' });
  }
  const { status, body } = translateError(err);
  logger.error('Error no controlado en Express', { status, error: err?.message });
  res.status(status).json(body);
});

async function start() {
  try {
    await security.loadPermission();
  } catch (err) {
    logger.error('No se pudo cargar la configuración de seguridad al iniciar', {
      name: err.name,
      code: err.code || null,
      error: err.message || String(err),
      causes: Array.isArray(err.errors) ? err.errors.map((e) => e.message || e.code) : undefined,
    });
  }

  if (ENABLE_HTTPS) {
    const keyPath = path.resolve(process.cwd(), process.env.TLS_KEY_PATH || 'certs/key.pem');
    const certPath = path.resolve(process.cwd(), process.env.TLS_CERT_PATH || 'certs/cert.pem');
    const credentials = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
    https.createServer(credentials, app).listen(HTTPS_PORT, () => {
      logger.info(`Servidor HTTPS/TLS escuchando en https://localhost:${HTTPS_PORT}`);
    });
  } else {
    http.createServer(app).listen(PORT, () => {
      logger.info(`Servidor HTTP escuchando en http://localhost:${PORT}`);
    });
  }
}

start();
