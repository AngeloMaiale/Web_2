'use strict';
const users = require('../repositories/UserRepository');
const { verify } = require('../security/PasswordHasher');

class ValidationError extends Error {}
class AuthError extends Error {}

function validateCredentials(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    throw new ValidationError('Usuario y contraseña son obligatorios');
  }
  if (username.length > 100 || password.length > 200) {
    throw new ValidationError('Usuario o contraseña demasiado largos');
  }
}

async function authenticate(username, password) {
  validateCredentials(username, password);

  const user = await users.findByUsername(username.trim());
  if (!user || !user.active || !verify(password, user.password_hash)) {
    throw new AuthError('Usuario o contraseña incorrectos');
  }

  const profile = await users.getProfiles(user.id);
  return { userId: user.id, username: user.username, profile };
}

module.exports = { authenticate, ValidationError, AuthError };
