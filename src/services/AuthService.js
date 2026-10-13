'use strict';
const PasswordHasher = require('../security/PasswordHasher');

class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

const INVALID_CREDENTIALS = 'Usuario o contraseña incorrectos';
// Hash de relleno: se verifica igual cuando el usuario no existe (tiempo de respuesta uniforme)
const DUMMY_HASH = PasswordHasher.hash('dummy-password');

class AuthService {
  constructor({ userRepository }) {
    this.users = userRepository;
  }

  static validateCredentials(username, password) {
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
      throw new ValidationError('Usuario y contraseña son obligatorios');
    }
    if (username.length > 100 || password.length > 200) {
      throw new ValidationError('Usuario o contraseña demasiado largos');
    }
  }

  /**
   * Valida credenciales contra la BD y obtiene los perfiles del usuario.
   * No genera tokens en la BD; la sesión la maneja express-session.
   */
  async authenticate(username, password) {
    AuthService.validateCredentials(username, password);

    const user = await this.users.findByUsername(username.trim());
    const ok = PasswordHasher.verify(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !user.active || !ok) throw new AuthError(INVALID_CREDENTIALS);

    const profile = await this.users.getProfiles(user.id);
    return {
      userId: user.id,
      username: user.username,
      email: user.email,
      profile,
    };
  }
}

module.exports = { AuthService, AuthError, ValidationError };
