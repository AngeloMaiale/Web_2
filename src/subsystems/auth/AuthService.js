'use strict';
const users = require('./UserRepository');
const { verify } = require('./PasswordHasher');
const { ValidationError, AuthError } = require('../../core/Errors');

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
  const validPassword = user && user.active ? await verify(password, user.password_hash) : false;
  if (!validPassword) {
    throw new AuthError('Usuario o contraseña incorrectos');
  }

  const profiles = await users.getProfiles(user.id);
  const activeProfile = profiles[0] || null;
  return {
    userId: user.id,
    username: user.username,
    profiles,
    activeProfile,
    employeeId: activeProfile?.employeeId ?? null,
  };
}

module.exports = { authenticate, ValidationError, AuthError };
