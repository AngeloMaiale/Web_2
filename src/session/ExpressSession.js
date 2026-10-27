'use strict';
const auth = require('../services/AuthService');

class ExpressSession {
  constructor(req) {
    this.req = req;
  }

  hasSession() {
    return Boolean(this.req.session.user);
  }

  async login(username, password) {
    if (!this.hasSession()) {
      const user = await auth.authenticate(username, password);
      this.req.session.user = user;
      // Compatibilidad con req.session.userData.profile (Foto 7)
      this.req.session.userData = user;
    }
    return this.toJSON();
  }

  logout() {
    return new Promise((resolve, reject) => {
      this.req.session.destroy((err) => (err ? reject(err) : resolve()));
    });
  }

  toJSON() {
    const { userId, username, profile } = this.req.session.user;
    return { userId, username, profile, expiresAt: this.req.session.cookie.expires };
  }
}

module.exports = ExpressSession;
