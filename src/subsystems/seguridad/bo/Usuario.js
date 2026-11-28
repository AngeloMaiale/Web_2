'use strict';
const db = require('../../db/DBComponent');
const { hash } = require('../../auth/PasswordHasher');
const auditLogger = require('../../../core/AuditLogger');
const { ValidationError, NotFoundError } = require('../../../core/Errors');

class Usuario {
  async listar(_filtros = {}, _context = {}) {
    return db.exe('listUsers', []);
  }

  async crear(dto = {}, context = {}) {
    const username = typeof dto.username === 'string' ? dto.username.trim() : '';
    const password = typeof dto.password === 'string' ? dto.password : '';
    const email = typeof dto.email === 'string' ? dto.email.trim() : null;
    const active = dto.active !== undefined ? Boolean(dto.active) : true;

    if (!username || username.length < 3 || username.length > 100) {
      throw new ValidationError('El usuario debe tener entre 3 y 100 caracteres');
    }
    if (!password || password.length < 6 || password.length > 200) {
      throw new ValidationError('La contraseña debe tener entre 6 y 200 caracteres');
    }

    const passwordHash = await hash(password);
    const rows = await db.exe('createUser', [username, passwordHash, email, active]);
    const created = rows[0];

    await auditLogger.log({
      tableName: 'app_user',
      rowId: created.id,
      action: 'INSERT',
      newData: created,
      actor: context.username || 'system',
    });

    return created;
  }

  async actualizar(id, dto = {}, context = {}) {
    const userId = Number(id);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new ValidationError('ID de usuario inválido');
    }

    const prevRows = await db.exe('getUserById', [userId]);
    const prev = prevRows[0];
    if (!prev) throw new NotFoundError(`Usuario ${userId} no encontrado`);

    const email = dto.email !== undefined ? (dto.email ? String(dto.email).trim() : null) : null;
    const active = dto.active !== undefined ? Boolean(dto.active) : null;

    const rows = await db.exe('updateUser', [userId, email, active]);
    const updated = rows[0];

    await auditLogger.log({
      tableName: 'app_user',
      rowId: userId,
      action: 'UPDATE',
      oldData: prev,
      newData: updated,
      actor: context.username || 'system',
    });

    return updated;
  }

  async asignarPerfil(userId, roleId, displayName, employeeId = null, companyId = 1, context = {}) {
    const uId = Number(userId);
    const rId = Number(roleId);
    const name = typeof displayName === 'string' ? displayName.trim() : '';

    if (!Number.isInteger(uId) || uId <= 0 || !Number.isInteger(rId) || rId <= 0) {
      throw new ValidationError('userId y roleId deben ser enteros positivos');
    }
    if (!name) {
      throw new ValidationError('displayName es obligatorio');
    }

    const empId = employeeId !== null && employeeId !== undefined && employeeId !== '' ? Number(employeeId) : null;
    const compId = companyId !== null && companyId !== undefined && companyId !== '' ? Number(companyId) : 1;

    const rows = await db.exe('assignUserProfile', [uId, rId, name, compId, empId]);
    const assigned = rows[0];

    await auditLogger.log({
      tableName: 'user_profile',
      rowId: assigned.id,
      action: 'INSERT',
      newData: assigned,
      actor: context.username || 'system',
    });

    return assigned;
  }

  async cambiarPassword(userId, newPassword, context = {}) {
    const uId = Number(userId);
    if (!Number.isInteger(uId) || uId <= 0) {
      throw new ValidationError('ID de usuario inválido');
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 200) {
      throw new ValidationError('La nueva contraseña debe tener entre 6 y 200 caracteres');
    }

    const prevRows = await db.exe('getUserById', [uId]);
    if (!prevRows[0]) throw new NotFoundError(`Usuario ${uId} no encontrado`);

    const passwordHash = await hash(newPassword);
    const rows = await db.exe('updateUserPassword', [uId, passwordHash]);

    await auditLogger.log({
      tableName: 'app_user',
      rowId: uId,
      action: 'UPDATE',
      oldData: { passwordChanged: false },
      newData: { passwordChanged: true },
      actor: context.username || 'system',
    });

    return rows[0];
  }
}

module.exports = Usuario;
