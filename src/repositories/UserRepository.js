'use strict';
const db = require('../db/Database');

async function findByUsername(username) {
  const rows = await db.query(
    `SELECT id, username, password_hash, active
       FROM app_user WHERE lower(username) = lower($1)`,
    [username]
  );
  return rows[0] || null;
}

function getProfiles(userId) {
  return db.query(
    `SELECT p.id AS "profileId", r.code AS role, r.name AS "roleName",
            p.display_name AS "displayName"
       FROM user_profile p JOIN role r ON r.id = p.role_id
      WHERE p.user_id = $1 AND p.active
      ORDER BY p.id`,
    [userId]
  );
}

module.exports = { findByUsername, getProfiles };
