'use strict';

class UserRepository {
  constructor(db) {
    this.db = db;
  }

  /** Incluye password_hash: solo para uso interno de autenticación. */
  findByUsername(username) {
    return this.db.one(
      `SELECT id, username, password_hash, email, active
         FROM app_user WHERE lower(username) = lower($1)`,
      [username]
    );
  }

  /** Perfiles activos del usuario, ya con nombres de campo para la sesión. */
  getProfiles(userId) {
    return this.db.query(
      `SELECT p.id AS "profileId", r.code AS role, r.name AS "roleName",
              p.display_name AS "displayName", p.company_id AS "companyId",
              p.employee_id AS "employeeId", p.data
         FROM user_profile p JOIN role r ON r.id = p.role_id
        WHERE p.user_id = $1 AND p.active
        ORDER BY p.id`,
      [userId]
    );
  }

  create({ username, passwordHash, email = null }) {
    return this.db.one(
      `INSERT INTO app_user (username, password_hash, email)
       VALUES ($1, $2, $3) RETURNING id, username`,
      [username, passwordHash, email]
    );
  }

  /** Devuelve { id } o null si el rol no existe. */
  addProfile({ userId, roleCode, displayName, companyId = null, employeeId = null, data = {} }) {
    return this.db.one(
      `INSERT INTO user_profile (user_id, role_id, display_name, company_id, employee_id, data)
       SELECT $1, r.id, $3, $4, $5, $6 FROM role r WHERE r.code = $2
       RETURNING id`,
      [userId, roleCode, displayName, companyId, employeeId, JSON.stringify(data)]
    );
  }
}

module.exports = UserRepository;
