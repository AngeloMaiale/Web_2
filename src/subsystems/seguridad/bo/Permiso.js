'use strict';
const db = require('../../db/DBComponent');
const security = require('../Security');
const auditLogger = require('../../../core/AuditLogger');
const { ValidationError } = require('../../../core/Errors');

class Permiso {
  async listarMatriz(_filtros = {}, _context = {}) {
    const [roles, methods, options, methodPermissions, optionPermissions] = await Promise.all([
      db.exe('listRoles', []),
      db.exe('listAllMethodsForMatrix', []),
      db.exe('listAllOptionsForMatrix', []),
      db.exe('listMethodPermissions', []),
      db.exe('listOptionPermissions', []),
    ]);

    return { roles, methods, options, methodPermissions, optionPermissions };
  }

  async actualizarPermisoMetodo(roleId, methodId, allowed = true, context = {}) {
    const res = await security.setPermissionMethod({
      roleId: Number(roleId),
      methodId: Number(methodId),
      allowed: Boolean(allowed),
    });

    await auditLogger.log({
      tableName: 'permission_method',
      rowId: Number(methodId),
      action: allowed ? 'INSERT' : 'DELETE',
      newData: res,
      actor: context.username || 'system',
    });

    return res;
  }

  async actualizarPermisoOpcion(roleId, optionId, allowed = true, context = {}) {
    const res = await security.setPermissionOption({
      roleId: Number(roleId),
      optionId: Number(optionId),
      allowed: Boolean(allowed),
    });

    await auditLogger.log({
      tableName: 'permission_option',
      rowId: Number(optionId),
      action: allowed ? 'INSERT' : 'DELETE',
      newData: res,
      actor: context.username || 'system',
    });

    return res;
  }

  async listarAuditoria(filtros = {}, _context = {}) {
    const tableName = typeof filtros?.tableName === 'string' && filtros.tableName.trim()
      ? filtros.tableName.trim()
      : null;
    const action = typeof filtros?.action === 'string' && filtros.action.trim()
      ? filtros.action.trim().toUpperCase()
      : null;
    if (action && !['INSERT', 'UPDATE', 'DELETE'].includes(action)) {
      throw new ValidationError('action debe ser INSERT, UPDATE o DELETE');
    }
    const actor = typeof filtros?.actor === 'string' && filtros.actor.trim()
      ? filtros.actor.trim()
      : null;
    const limit = filtros?.limit ? Math.min(Math.max(Number(filtros.limit), 1), 500) : 100;

    return db.exe('listAuditLogs', [tableName, action, actor, limit]);
  }
}

module.exports = Permiso;
