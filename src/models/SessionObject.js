'use strict';

/**
 * Objeto de sesión: lo que el resto del sistema (server/frontend) consume.
 * profile es un arreglo: un usuario puede tener varios perfiles/roles.
 */
class SessionObject {
  constructor({ userId, username, profile = [], token = null, expiresAt = null }) {
    this.userId = userId;
    this.username = username;
    this.profile = profile; // [{ profileId, role, roleName, displayName, companyId, employeeId, data }]
    this.token = token;
    this.expiresAt = expiresAt;
  }

  hasRole(roleCode) {
    return this.profile.some((p) => p.role === roleCode);
  }

  /** Versión segura para enviar al frontend. */
  toJSON() {
    return {
      userId: this.userId,
      username: this.username,
      profile: this.profile,
      token: this.token,
      expiresAt: this.expiresAt,
    };
  }
}

module.exports = SessionObject;
