'use strict';
const { Pool, types } = require('pg');

// Los ids bigint llegan como string por defecto; aquí caben de sobra en Number.
types.setTypeParser(20, (v) => Number(v));

/** Envoltorio mínimo del pool de pg. Usa las variables PG* del entorno por defecto. */
class Database {
  constructor(config = {}) {
    // Por defecto apunta a la base de datos Docker del proyecto (docker compose up -d).
    // Cualquier variable PG* del entorno, o un objeto config, la sobrescribe.
    const env = process.env;
    this.pool = new Pool({
      host: env.PGHOST || 'localhost',
      port: Number(env.PGPORT) || 5433,
      user: env.PGUSER || 'nomina',
      password: env.PGPASSWORD || 'nomina',
      database: env.PGDATABASE || 'nomina',
      options: '-c search_path=payroll,public',
      ...config,
    });
  }

  /** Devuelve las filas directamente. */
  async query(text, params = []) {
    const result = await this.pool.query(text, params);
    return result.rows;
  }

  /** Devuelve la primera fila o null. */
  async one(text, params = []) {
    const rows = await this.query(text, params);
    return rows[0] || null;
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = Database;
