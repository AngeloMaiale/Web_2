'use strict';
const express = require('express');
const auth = require('./AuthService');
const jwtSession = require('./JwtSession');
const security = require('../seguridad/Security');
const logger = require('../../core/Logger');
const { ValidationError, AuthError, ForbiddenError, okResponse, translateError } = require('../../core/Errors');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const userData = await auth.authenticate(username, password);
    const { token, session } = jwtSession.createToken(userData);
    const profilesForOptions = session.activeProfile ? [session.activeProfile] : session.profiles;
    const allowedOptions = security.getAllowedOptions(profilesForOptions);

    res.setHeader('Authorization', `Bearer ${token}`);
    logger.security('Login exitoso', {
      userId: session.userId,
      username: session.username,
      activeProfile: session.activeProfile?.role || null,
      ip: req.ip,
    });

    res.json(okResponse({ token, session, allowedOptions }, 'Inicio de sesión exitoso'));
  } catch (err) {
    if (err instanceof ValidationError || err instanceof AuthError) {
      logger.security('Intento de login fallido', {
        username: req.body?.username || null,
        reason: err.message,
        ip: req.ip,
      });
    } else {
      logger.error('Error interno en /api/auth/login', {
        name: err.name,
        code: err.code || null,
        error: err.message || String(err),
        causes: Array.isArray(err.errors) ? err.errors.map((e) => e.message || e.code) : undefined,
      });
    }
    const { status, body } = translateError(err);
    res.status(status).json(body);
  }
});

router.get('/session', (req, res) => {
  const session = jwtSession.getSession(req);
  if (!session) {
    return res.json({ ok: true, code: 'OK', active: false, data: null });
  }

  const profilesForOptions = session.activeProfile ? [session.activeProfile] : session.profiles;
  const allowedOptions = security.getAllowedOptions(profilesForOptions);
  res.json({
    ok: true,
    code: 'OK',
    active: true,
    data: { session, allowedOptions },
  });
});

router.post('/switch-profile', (req, res) => {
  try {
    const current = jwtSession.getSession(req);
    if (!current) {
      throw new AuthError('Debe iniciar sesión');
    }

    const { role } = req.body || {};
    if (typeof role !== 'string' || !role.trim()) {
      throw new ValidationError('El código de perfil (role) es obligatorio');
    }

    const switched = jwtSession.switchProfile(req, role.trim());
    if (!switched || switched.error) {
      throw new ForbiddenError(switched?.error || 'No tiene acceso a ese perfil');
    }

    const { token, session } = switched;
    const allowedOptions = security.getAllowedOptions(session.activeProfile ? [session.activeProfile] : []);
    res.setHeader('Authorization', `Bearer ${token}`);
    logger.security('Cambio de perfil activo', {
      userId: session.userId,
      username: session.username,
      newProfile: session.activeProfile?.role || null,
      ip: req.ip,
    });

    res.json(okResponse({ token, session, allowedOptions }, 'Perfil actualizado'));
  } catch (err) {
    const { status, body } = translateError(err);
    res.status(status).json(body);
  }
});

router.post('/logout', (req, res) => {
  const session = jwtSession.getSession(req);
  const revoked = jwtSession.revoke(req);
  if (session) {
    logger.security('Cierre de sesión (JWT revocado)', {
      userId: session.userId,
      username: session.username,
      revoked,
      ip: req.ip,
    });
  }
  res.json(okResponse({ revoked }, 'Sesión cerrada correctamente'));
});

module.exports = router;
