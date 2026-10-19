'use strict';
const db = require('../../db/Database');

class Empresa {
  listar() {
    return db.query('SELECT id, legal_name AS nombre, rif FROM company ORDER BY id');
  }

  crear(nombre, rif) {
    return db.query(
      'INSERT INTO company (legal_name, rif) VALUES ($1, $2) RETURNING id, legal_name AS nombre, rif',
      [nombre, rif]
    );
  }
}

module.exports = Empresa;
