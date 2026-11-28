'use strict';
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
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

const YAML_FILES = [
  path.join(__dirname, 'queries/seguridad.yaml'),
  path.join(__dirname, 'queries/nomina.yaml'),
];

function loadSentences() {
  const merged = {};
  for (const filePath of YAML_FILES) {
    if (!fs.existsSync(filePath)) continue;
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = yaml.load(raw) || {};
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`Formato inválido en archivo YAML: ${path.basename(filePath)}`);
    }
    for (const [key, sql] of Object.entries(parsed)) {
      if (typeof sql === 'string' && sql.trim()) {
        merged[key] = sql.trim();
      }
    }
  }
  return merged;
}

const sentences = loadSentences();

function getSql(queryName) {
  const sql = sentences[queryName];
  if (!sql) {
    throw new Error(`Sentencia no encontrada en YAML: ${queryName}`);
  }
  return sql;
}

async function exe(queryName, params = []) {
  const sql = getSql(queryName);
  const result = await pool.query(sql, params);
  return result.rows;
}

async function withTransaction(fn) {
  const client = await pool.connect();
  const txDb = {
    async exe(queryName, params = []) {
      const sql = getSql(queryName);
      const result = await client.query(sql, params);
      return result.rows;
    },
  };

  try {
    await client.query('BEGIN');
    const output = await fn(txDb);
    await client.query('COMMIT');
    return output;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { exe, withTransaction, pool };
