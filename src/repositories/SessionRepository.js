'use strict';
const crypto = require('crypto');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

class SessionRepository {
  constructor(db) {
    this.db = db;
  }

  /** Crea la sesión y devuelve { token, expiresAt }. El token en claro solo existe aquí. */
  async create(userId, ttlHours = 8) {
    const token = crypto.randomBytes(32).toString('hex');
    const row = await this.db.one(
      `INSERT INTO user_session (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + make_interval(hours => $3))
       RETURNING expires_at AS "expiresAt"`,
      [userId, sha256(token), ttlHours]
    );
    return { token, expiresAt: row.expiresAt };
  }

  /** Devuelve { userId, expiresAt } si el token existe y no expiró; si no, null. */
  findValid(token) {
    return this.db.one(
      `SELECT user_id AS "userId", expires_at AS "expiresAt"
         FROM user_session WHERE token_hash = $1 AND expires_at > now()`,
      [sha256(token)]
    );
  }

  async delete(token) {
    await this.db.query('DELETE FROM user_session WHERE token_hash = $1', [sha256(token)]);
  }

  async deleteExpired() {
    await this.db.query('DELETE FROM user_session WHERE expires_at <= now()');
  }
}

module.exports = SessionRepository;
