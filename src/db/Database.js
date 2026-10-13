'use strict';
const { Pool, types } = require('pg');

types.setTypeParser(20, (v) => Number(v));

class Database {
  constructor(config = {}) {
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

  async query(text, params = []) {
    const result = await this.pool.query(text, params);
    return result.rows;
  }

  async one(text, params = []) {
    const rows = await this.query(text, params);
    return rows[0] || null;
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = Database;
