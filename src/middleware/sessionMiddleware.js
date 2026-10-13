'use strict';
const session = require('express-session');
const ExpressSession = require('../session/ExpressSession');

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
      req.userSession = new ExpressSession(req, res, authService);
      next();
    },
  ];
}

module.exports = {
  createSessionMiddleware,
};
