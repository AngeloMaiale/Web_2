'use strict';
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;

async function hash(plainPassword) {
  if (typeof plainPassword !== 'string' || !plainPassword) {
    throw new Error('La contraseña no puede estar vacía');
  }
  const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
  return bcrypt.hash(plainPassword, salt);
}

async function verify(plainPassword, storedHash) {
  if (typeof plainPassword !== 'string' || typeof storedHash !== 'string' || !storedHash) {
    return false;
  }
  return bcrypt.compare(plainPassword, storedHash);
}

module.exports = { hash, verify };
