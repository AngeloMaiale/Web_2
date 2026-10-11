'use strict';
const PasswordHasher = require('../security/PasswordHasher');
const SessionObject = require('../models/SessionObject');

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
  constructor({ userRepository, sessionRepository, ttlHours = Number(process.env.SESSION_TTL_HOURS) || 8 }) {
    this.users = userRepository;
    this.sessions = sessionRepository;
    this.ttlHours = ttlHours;
  }

  static validateCredentials(username, password) {
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
      throw new ValidationError('Usuario y contraseña son obligatorios');
    }
    if (username.length > 100 || password.length > 200) {
      throw new ValidationError('Usuario o contraseña demasiado largos');
    }
  }

  /** Autentica y crea la sesión. Lanza ValidationError o AuthError. Devuelve SessionObject. */
  async login(username, password) {
    AuthService.validateCredentials(username, password);

    const user = await this.users.findByUsername(username.trim());
    const ok = PasswordHasher.verify(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !user.active || !ok) throw new AuthError(INVALID_CREDENTIALS);

    const { token, expiresAt } = await this.sessions.create(user.id, this.ttlHours);
    const profile = await this.users.getProfiles(user.id);
    return new SessionObject({ userId: user.id, username: user.username, profile, token, expiresAt });
  }

  /** ¿Tiene sesión? SessionObject si el token es válido; null si debe autenticarse. */
  async getSession(token) {
    if (typeof token !== 'string' || !token) return null;
    const session = await this.sessions.findValid(token);
    if (!session) return null;
    const user = await this.users.findById(session.userId);
    if (!user || !user.active) return null;
    const profile = await this.users.getProfiles(user.id);
    return new SessionObject({ userId: user.id, username: user.username, profile, token, expiresAt: session.expiresAt });
  }

  logout(token) {
    return this.sessions.delete(token);
  }
}

module.exports = { AuthService, AuthError, ValidationError };
