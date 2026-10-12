'use strict';
const session = require('express-session');
const ExpressSession = require('../session/ExpressSession');

/**
 * Crea la configuración del middleware de sesión para Express,
 * inyectando automáticamente la instancia `req.userSession`.
 *
 * @param {Object} options
 * @param {Object} options.authService - Instancia de AuthService
 * @param {string} [options.secret] - Secreto para firmar cookies de sesión
 * @param {number} [options.ttlHours] - Duración en horas de la sesión (def: 8)
 * @param {Object} [options.sessionOptions] - Opciones adicionales para express-session
 */
function createSessionMiddleware({
  authService,
  secret = process.env.SESSION_SECRET || 'nomina-secreto-seguro-dev-key',
  ttlHours = Number(process.env.SESSION_TTL_HOURS) || 8,
  sessionOptions = {},
}) {
  const maxAgeMs = ttlHours * 60 * 60 * 1000;

  const baseSession = session({
    secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: maxAgeMs,
      sameSite: 'lax',
    },
    ...sessionOptions,
  });

  return [
    baseSession,
    (req, res, next) => {
      // Inyectamos nuestro objeto wrapper de sesión en cada petición
      req.userSession = new ExpressSession(req, res, authService);
      next();
    },
  ];
}

/**
 * Middleware para proteger rutas que exigen sesión activa.
 */
function requireSession(req, res, next) {
  if (!req.userSession || !req.userSession.hasSession()) {
    return res.status(401).json({
      ok: false,
      error: 'No autenticado: requiere inicio de sesión activo',
    });
  }
  next();
}

/**
 * Middleware para proteger rutas según el rol (ADMIN, PAYROLL_MANAGER, EMPLOYEE, etc.)
 */
function requireRole(roleCode) {
  return (req, res, next) => {
    if (!req.userSession || !req.userSession.hasSession()) {
      return res.status(401).json({
        ok: false,
        error: 'No autenticado: requiere inicio de sesión activo',
      });
    }

    if (!req.userSession.hasRole(roleCode)) {
      return res.status(403).json({
        ok: false,
        error: `Acceso denegado: se requiere el rol ${roleCode}`,
      });
    }

    next();
  };
}

module.exports = {
  createSessionMiddleware,
  requireSession,
  requireRole,
};
