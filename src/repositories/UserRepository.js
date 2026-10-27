'use strict';
const db = require('../db/Database');

async function findByUsername(username) {
  const rows = await db.exe('getUser', [username]);
  return rows[0] || null;
}

function getProfiles(userId) {
  return db.exe('getProfiles', [userId]);
}

module.exports = { findByUsername, getProfiles };
