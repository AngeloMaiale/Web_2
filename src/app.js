'use strict';
const express = require('express');
const { createSessionMiddleware } = require('./middleware/sessionMiddleware');
const createAuthRoutes = require('./routes/authRoutes');

/**
 * Crea y configura la aplicación Express con el sistema de sesiones.
 * @param {Object} options
 * @param {Object} options.authService - Instancia de AuthService
 * @param {string} [options.secret] - Secreto para cookies
 * @param {number} [options.ttlHours] - Tiempo de vida de la sesión en horas
 * @param {Object} [options.sessionOptions] - Opciones extra de express-session
 */
function createApp({ authService, secret, ttlHours, sessionOptions = {} } = {}) {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Inyecta express-session y la instancia req.userSession
  app.use(
    createSessionMiddleware({
      authService,
      secret,
      ttlHours,
      sessionOptions,
    })
  );

  // Servir frontend estático
  const path = require('path');
  app.use(express.static(path.join(__dirname, '../frontend')));

  // Montar rutas de autenticación
  app.use('/api/auth', createAuthRoutes());

  // Ruta informativa de estado de la API
  app.get('/api/status', (req, res) => {
    res.json({
      name: 'Sistema de Nómina (Venezuela) - Módulo de Sesión Express',
      hasActiveSession: req.userSession.hasSession(),
      endpoints: [
        'POST /api/auth/login',
        'GET  /api/auth/session',
        'POST /api/auth/logout',
        'GET  /api/auth/me',
        'GET  /api/auth/admin-check',
      ],
    });
  });

  return app;
}

module.exports = createApp;
