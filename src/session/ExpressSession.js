'use strict';

class ExpressSession {
  constructor(req, res = null, authService = null) {
    this._req = req;
    this._res = res;
    this._authService = authService;
  }

  get sessionId() {
    return this._req?.sessionID || this._req?.session?.id || null;
  }

  get userId() {
    return this._req?.session?.user?.userId ?? null;
  }

  get username() {
    return this._req?.session?.user?.username ?? null;
  }

  get profile() {
    return this._req?.session?.user?.profile ?? [];
  }

  get createdAt() {
    return this._req?.session?.user?.createdAt ?? null;
  }

  get cookie() {
    if (!this._req?.session?.cookie) return null;
    const c = this._req.session.cookie;
    return {
      maxAge: c.maxAge,
      originalMaxAge: c.originalMaxAge,
      expires: c.expires ? new Date(c.expires).toISOString() : null,
      httpOnly: c.httpOnly,
      path: c.path,
      secure: c.secure,
      sameSite: c.sameSite || null,
    };
  }

  hasSession() {
    return Boolean(this._req?.session?.user?.userId);
  }

  async login(username, password) {
    if (!this._authService) {
      throw new Error('AuthService no configurado en ExpressSession');
    }

    if (this.hasSession()) {
      return {
        ok: true,
        alreadyAuthenticated: true,
        message: 'Ya tiene sesión iniciada',
        session: this.toJSON(),
      };
    }

    const authData = await this._authService.authenticate(username, password);

    if (!this._req.session) {
      throw new Error('El middleware express-session no está activo o configurado en la petición');
    }

    this._req.session.user = {
      userId: authData.userId,
      username: authData.username,
      profile: authData.profile,
      createdAt: new Date().toISOString(),
    };

    await new Promise((resolve, reject) => {
      this._req.session.save((err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    return {
      ok: true,
      alreadyAuthenticated: false,
      message: 'Sesión creada exitosamente',
      session: this.toJSON(),
    };
  }

  async destroy() {
    return new Promise((resolve, reject) => {
      if (!this._req?.session) {
        return resolve({ ok: true, message: 'No había sesión activa' });
      }

      const cookieName = this._req.session.cookie?.name || 'connect.sid';

      this._req.session.destroy((err) => {
        if (err) return reject(err);

        if (this._res && typeof this._res.clearCookie === 'function') {
          this._res.clearCookie(cookieName);
        }

        resolve({ ok: true, message: 'Sesión cerrada exitosamente' });
      });
    });
  }

  toJSON() {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      username: this.username,
      profile: this.profile,
      cookie: this.cookie,
      createdAt: this.createdAt,
    };
  }
}

module.exports = ExpressSession;
