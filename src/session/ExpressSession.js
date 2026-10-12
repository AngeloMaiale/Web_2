'use strict';

/**
 * Objeto wrapper de Express Session.
 * Implementa y envuelve req.session de express-session,
 * gestionando UserId, UserName, Profile[] y variables de sesión/cookies.
 */
class ExpressSession {
  /**
   * @param {import('express').Request} req - Petición de Express con req.session
   * @param {import('express').Response} [res] - Respuesta de Express (opcional, para limpiar cookies)
   * @param {Object} [authService] - Instancia de AuthService para validación contra la BD
   */
  constructor(req, res = null, authService = null) {
    this._req = req;
    this._res = res;
    this._authService = authService;
  }

  /** Acceso al objeto nativo req.session de express-session */
  get rawSession() {
    return this._req?.session || null;
  }

  /** ID de la sesión asignado por express-session */
  get sessionId() {
    return this._req?.sessionID || this._req?.session?.id || null;
  }

  /** ID numérico del usuario autenticado */
  get userId() {
    return this._req?.session?.user?.userId ?? null;
  }
  // Alias UserId para compatibilidad directa con el diagrama
  get UserId() {
    return this.userId;
  }

  /** Nombre del usuario */
  get username() {
    return this._req?.session?.user?.username ?? null;
  }
  // Alias UserName para compatibilidad directa con el diagrama
  get UserName() {
    return this.username;
  }

  /**
   * Lista de perfiles y roles del usuario:
   * [{ profileId, role, roleName, displayName, companyId, employeeId, data }]
   */
  get profile() {
    return this._req?.session?.user?.profile ?? [];
  }
  // Alias Profile para compatibilidad directa con el diagrama
  get Profile() {
    return this.profile;
  }

  /** Fecha y hora en la que se inició la sesión */
  get createdAt() {
    return this._req?.session?.user?.createdAt ?? null;
  }

  /** Información y variables medidas en la sesión (cookie) */
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

  /**
   * Verifica si existe una sesión activa actualmente.
   * Representa la condición "¿tiene session?" del flujo.
   */
  hasSession() {
    return Boolean(this._req?.session?.user?.userId);
  }

  /**
   * Valida si el usuario actual cuenta con un rol determinado dentro de sus perfiles.
   * @param {string} roleCode - Ej: 'ADMIN', 'PAYROLL_MANAGER', 'EMPLOYEE'
   */
  hasRole(roleCode) {
    return this.profile.some((p) => p.role === roleCode);
  }

  /**
   * Proceso de Login según el diagrama de flujo:
   * 1. ¿Tiene sesión? -> Si ya tiene, retorna que ya cuenta con sesión iniciada.
   * 2. Si no -> Valida datos (autenticación contra la BD mediante AuthService).
   * 3. Si autentica -> Crea la sesión en Express guardando UserId, UserName y Profile[].
   */
  async login(username, password) {
    if (!this._authService) {
      throw new Error('AuthService no configurado en ExpressSession');
    }

    // 1. ¿Tiene sesión previa?
    if (this.hasSession()) {
      return {
        ok: true,
        alreadyAuthenticated: true,
        message: 'Ya tiene sesión iniciada',
        session: this.toJSON(),
      };
    }

    // 2. Autentica contra la base de datos (lanza AuthError o ValidationError si falla)
    const authData = await this._authService.authenticate(username, password);

    // 3. Crear sesión en el objeto express-session
    if (!this._req.session) {
      throw new Error('El middleware express-session no está activo o configurado en la petición');
    }

    this._req.session.user = {
      userId: authData.userId,
      username: authData.username,
      profile: authData.profile,
      createdAt: new Date().toISOString(),
    };

    // Guardado explícito para garantizar persistencia antes de responder
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

  /**
   * Cierra/destruye la sesión en Express y elimina la cookie del cliente.
   */
  async destroy() {
    return new Promise((resolve, reject) => {
      if (!this._req?.session) {
        return resolve({ ok: true, message: 'No había sesión activa' });
      }

      // Nombre por defecto o configurado de la cookie
      const cookieName = this._req.session.cookie?.name || 'connect.sid';

      this._req.session.destroy((err) => {
        if (err) return reject(err);

        // Limpiar cookie en la respuesta HTTP
        if (this._res && typeof this._res.clearCookie === 'function') {
          this._res.clearCookie(cookieName);
        }

        resolve({ ok: true, message: 'Sesión cerrada exitosamente' });
      });
    });
  }

  /**
   * Representación limpia en JSON del objeto de sesión.
   */
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
