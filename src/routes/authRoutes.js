'use strict';
const express = require('express');
const { AuthError, ValidationError } = require('../services/AuthService');

function createAuthRoutes() {
  const router = express.Router();

  /**
   * POST /login
   * Valida credenciales contra la BD y crea la sesión express,
   * o devuelve la sesión si ya estaba iniciada.
   */
  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body || {};
      const result = await req.userSession.login(username, password);

      return res.status(200).json(result);
    } catch (err) {
      if (err instanceof ValidationError) {
        return res.status(400).json({ ok: false, error: err.message });
      }
      if (err instanceof AuthError) {
        return res.status(401).json({ ok: false, error: err.message });
      }

      console.error('Error durante /login:', err);
      return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
    }
  });

  /**
   * GET /session
   * Consulta el estado actual de la sesión y las variables de cookie.
   */
  router.get('/session', (req, res) => {
    if (req.userSession.hasSession()) {
      return res.status(200).json({
        ok: true,
        active: true,
        session: req.userSession.toJSON(),
      });
    }

    return res.status(200).json({
      ok: true,
      active: false,
      message: 'No hay sesión activa',
      session: null,
    });
  });

  /**
   * POST /logout
   * Destruye la sesión de express y borra la cookie.
   */
  router.post('/logout', async (req, res) => {
    try {
      const result = await req.userSession.destroy();
      return res.status(200).json(result);
    } catch (err) {
      console.error('Error durante /logout:', err);
      return res.status(500).json({ ok: false, error: 'Error al cerrar sesión' });
    }
  });

  return router;
}

module.exports = createAuthRoutes;
