'use strict';
const db = require('../../db/DBComponent');

class Empresa {
  listar() {
    return db.exe('listarEmpresas');
  }

  crear(nombre, rif) {
    return db.exe('crearEmpresa', [nombre, rif]);
  }
}

module.exports = Empresa;
