'use strict';
const { Pool, types } = require('pg');

types.setTypeParser(20, Number);

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5433,
  user: process.env.PGUSER || 'nomina',
  password: process.env.PGPASSWORD || 'nomina',
  database: process.env.PGDATABASE || 'nomina',
  options: '-c search_path=payroll,public',
});

async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

module.exports = { query };
