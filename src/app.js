'use strict';
const express = require('express');
const { createSessionMiddleware } = require('./middleware/sessionMiddleware');
const createAuthRoutes = require('./routes/authRoutes');

function createApp({ authService, secret, ttlHours, sessionOptions = {} } = {}) {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(
    createSessionMiddleware({
      authService,
      secret,
      ttlHours,
      sessionOptions,
    })
  );

  const path = require('path');
  app.use(express.static(path.join(__dirname, '../frontend')));

  app.use('/api/auth', createAuthRoutes());

  return app;
}

module.exports = createApp;
