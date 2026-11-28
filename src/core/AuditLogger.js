'use strict';
const db = require('../subsystems/db/DBComponent');
const logger = require('./Logger');

/**
 * Registra eventos de auditoría funcional en payroll.audit_log.
 */
async function log({ tableName, rowId = null, action, oldData = null, newData = null, actor = 'system' }, txDb = null) {
  try {
    const runner = txDb && typeof txDb.exe === 'function' ? txDb : db;
    await runner.exe('insertAuditLog', [
      tableName,
      rowId !== undefined && rowId !== null ? Number(rowId) : null,
      action,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
      actor || 'system',
    ]);
  } catch (err) {
    logger.error('Error registrando en audit_log', {
      tableName,
      rowId,
      action,
      error: err.message,
    });
  }
}

module.exports = { log };
