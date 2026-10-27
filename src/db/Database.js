'use strict';
const fs = require('fs');
const path = require('path');
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

// Parser liviano para extraer queries del archivo .yaml sin dependencias externas
function loadYamlQueries() {
  const possiblePaths = [
    path.join(__dirname, 'sentences1.yaml'),
    path.join(__dirname, 'sentences.yaml'),
    path.join(__dirname, '../../sentences1.yaml'),
    path.join(__dirname, '../../sentences.yaml')
  ];
  const filePath = possiblePaths.find((p) => fs.existsSync(p));
  if (!filePath) {
    throw new Error('No se encontró el archivo de sentencias YAML (sentences1.yaml o sentences.yaml)');
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const queries = {};

  let currentKey = null;
  let currentLines = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = rawLine.match(/^([a-zA-Z0-9_]+)\s*:\s*(.*)$/);
    if (match) {
      if (currentKey) {
        queries[currentKey] = currentLines.join(' ').trim();
      }
      currentKey = match[1];
      const remainder = match[2].trim();
      currentLines = (remainder && remainder !== '>' && remainder !== '|') ? [remainder] : [];
    } else if (currentKey) {
      currentLines.push(trimmed);
    }
  }

  if (currentKey) {
    queries[currentKey] = currentLines.join(' ').trim();
  }

  return queries;
}

let cachedQueries = null;

function getQueries() {
  if (!cachedQueries) {
    cachedQueries = loadYamlQueries();
  }
  return cachedQueries;
}

async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

// db.exe("getUser", [....]) según sentencia YAML (Foto 5)
async function exe(queryName, params = []) {
  const queries = getQueries();
  const sql = queries[queryName];
  if (!sql) {
    throw new Error(`Consulta '${queryName}' no encontrada en el archivo YAML.`);
  }
  return query(sql, params);
}

module.exports = { query, exe, getQueries };
