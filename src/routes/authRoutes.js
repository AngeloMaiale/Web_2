'use strict';
const express = require('express');
const { ValidationError, AuthError } = require('../services/AuthService');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const session = await req.userSession.login(username, password);
    res.json({ ok: true, session });
  } catch (err) {
    if (err instanceof ValidationError) return res.status(400).json({ ok: false, error: err.message });
    if (err instanceof AuthError) return res.status(401).json({ ok: false, error: err.message });
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
});

router.get('/session', (req, res) => {
  const active = req.userSession.hasSession();
  res.json({ ok: true, active, session: active ? req.userSession.toJSON() : null });
});

router.post('/logout', async (req, res) => {
  await req.userSession.logout();
  res.clearCookie('connect.sid');
  res.json({ ok: true });
});

module.exports = router;
