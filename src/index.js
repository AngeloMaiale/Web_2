'use strict';
const Database = require('./db/Database');
const UserRepository = require('./repositories/UserRepository');
const { AuthService, AuthError, ValidationError } = require('./services/AuthService');
const PasswordHasher = require('./security/PasswordHasher');

const ExpressSession = require('./session/ExpressSession');
const { createSessionMiddleware } = require('./middleware/sessionMiddleware');
const createApp = require('./app');
const createAuthRoutes = require('./routes/authRoutes');

/** Arma todo con una sola llamada: const { auth, db } = createAuth(); */
function createAuth(dbConfig = {}) {
  const db = new Database(dbConfig);
  const userRepository = new UserRepository(db);
  const auth = new AuthService({ userRepository });
  return { db, userRepository, auth };
}

module.exports = {
  createAuth,
  Database,
  UserRepository,
  AuthService,
  AuthError,
  ValidationError,
  PasswordHasher,
  // Integración Express Session
  ExpressSession,
  createSessionMiddleware,
  createApp,
  createAuthRoutes,
};
