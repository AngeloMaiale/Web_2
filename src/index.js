'use strict';
const Database = require('./db/Database');
const UserRepository = require('./repositories/UserRepository');
const SessionRepository = require('./repositories/SessionRepository');
const { AuthService, AuthError, ValidationError } = require('./services/AuthService');
const SessionObject = require('./models/SessionObject');
const PasswordHasher = require('./security/PasswordHasher');

/** Arma todo con una sola llamada: const { auth, db } = createAuth(); */
function createAuth(dbConfig = {}) {
  const db = new Database(dbConfig);
  const userRepository = new UserRepository(db);
  const sessionRepository = new SessionRepository(db);
  const auth = new AuthService({ userRepository, sessionRepository });
  return { db, userRepository, sessionRepository, auth };
}

module.exports = {
  createAuth, Database, UserRepository, SessionRepository,
  AuthService, AuthError, ValidationError, SessionObject, PasswordHasher,
};
