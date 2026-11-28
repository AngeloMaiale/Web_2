'use strict';
const path = require('path');
const db = require('../db/DBComponent');
const logger = require('../../core/Logger');
const { NotFoundError, ValidationError } = require('../../core/Errors');

class Security {
  constructor() {
    this.permissionMethodMap = new Map();
    this.permissionOptionMap = new Map();
    this.txMap = new Map();
    this.allOptions = [];
    this.loaded = false;
  }

  static methodKey(subsystem, className, method, profile) {
    return `${subsystem}_${className}_${method}_${profile}`;
  }

  static optionKey(subsystem, option, profile) {
    return `${subsystem}_${option}_${profile}`;
  }

  getPermissionMethod(key) {
    return this.permissionMethodMap.get(String(key)) === true;
  }

  getPermissionOption(key) {
    return this.permissionOptionMap.get(String(key)) === true;
  }

  _setMethodMapEntry(key, allowed) {
    if (allowed === false) {
      this.permissionMethodMap.delete(String(key));
    } else {
      this.permissionMethodMap.set(String(key), true);
    }
  }

  _setOptionMapEntry(key, allowed) {
    if (allowed === false) {
      this.permissionOptionMap.delete(String(key));
    } else {
      this.permissionOptionMap.set(String(key), true);
    }
  }

  async setPermissionMethod(input) {
    if (typeof input === 'string') {
      this._setMethodMapEntry(input, true);
      return true;
    }
    if (!input || typeof input !== 'object') {
      throw new ValidationError('Parámetro inválido para setPermissionMethod');
    }

    if (input.key !== undefined && input.roleId === undefined) {
      const allowed = input.value !== false && input.allowed !== false;
      this._setMethodMapEntry(input.key, allowed);
      return allowed;
    }

    const roleId = Number(input.roleId);
    const methodId = Number(input.methodId);
    const allowed = input.allowed !== false;
    if (!Number.isInteger(roleId) || !Number.isInteger(methodId)) {
      throw new ValidationError('roleId y methodId deben ser enteros válidos');
    }

    const [roleRows, methodRows] = await Promise.all([
      db.exe('getRoleById', [roleId]),
      db.exe('getMethodById', [methodId]),
    ]);
    const role = roleRows[0];
    const method = methodRows[0];
    if (!role) throw new NotFoundError(`Rol ${roleId} no encontrado`);
    if (!method) throw new NotFoundError(`Método ${methodId} no encontrado`);

    await db.exe(allowed ? 'grantMethodPermission' : 'revokeMethodPermission', [roleId, methodId]);

    this._setMethodMapEntry(Security.methodKey(method.subsystem, method.class, method.method, role.code), allowed);
    this._setMethodMapEntry(Security.methodKey(method.subsystem, method.class, method.method, role.id), allowed);
    return { roleId, methodId, allowed };
  }

  async setPermissionOption(input) {
    if (typeof input === 'string') {
      this._setOptionMapEntry(input, true);
      return true;
    }
    if (!input || typeof input !== 'object') {
      throw new ValidationError('Parámetro inválido para setPermissionOption');
    }

    if (input.key !== undefined && input.roleId === undefined) {
      const allowed = input.value !== false && input.allowed !== false;
      this._setOptionMapEntry(input.key, allowed);
      return allowed;
    }

    const roleId = Number(input.roleId);
    const optionId = Number(input.optionId);
    const allowed = input.allowed !== false;
    if (!Number.isInteger(roleId) || !Number.isInteger(optionId)) {
      throw new ValidationError('roleId y optionId deben ser enteros válidos');
    }

    const [roleRows, optionRows] = await Promise.all([
      db.exe('getRoleById', [roleId]),
      db.exe('getOptionById', [optionId]),
    ]);
    const role = roleRows[0];
    const option = optionRows[0];
    if (!role) throw new NotFoundError(`Rol ${roleId} no encontrado`);
    if (!option) throw new NotFoundError(`Opción ${optionId} no encontrada`);

    await db.exe(allowed ? 'grantOptionPermission' : 'revokeOptionPermission', [roleId, optionId]);

    this._setOptionMapEntry(Security.optionKey(option.subsystem, option.option, role.code), allowed);
    this._setOptionMapEntry(Security.optionKey(option.subsystem, option.option, role.id), allowed);
    return { roleId, optionId, allowed };
  }

  async loadPermission() {
    const methods = await db.exe('getAllBOMethods', []);
    this.txMap.clear();

    const boInstances = new Map();
    for (const row of methods) {
      const tx = Number(row.tx);
      const subsystem = row.subsystem;
      const className = row.class;
      const method = row.method;
      const boKey = `${subsystem}/${className}`;

      let instance = boInstances.get(boKey);
      if (instance === undefined) {
        // Cada subsistema aloja sus Business Objects en src/subsystems/<subsystem>/bo/<Class>.js
        const boPath = path.join(__dirname, '..', subsystem, 'bo', className);
        try {
          const BOClass = require(boPath);
          instance = new BOClass();
          boInstances.set(boKey, instance);
        } catch (err) {
          logger.warn(`B.O. aún no disponible para ${boKey} (tx ${tx}): ${err.message}`);
          instance = null;
          boInstances.set(boKey, null);
        }
      }

      this.txMap.set(tx, {
        tx,
        methodId: row.method_id,
        subsystem,
        class: className,
        method,
        instance,
      });
    }

    const methodPermRows = await db.exe('getPermissionMethods', []);
    this.permissionMethodMap.clear();
    for (const row of methodPermRows) {
      if (row.role) {
        this._setMethodMapEntry(Security.methodKey(row.subsystem, row.class, row.method, row.role), true);
      }
      if (row.role_id) {
        this._setMethodMapEntry(Security.methodKey(row.subsystem, row.class, row.method, row.role_id), true);
      }
    }

    const optionPermRows = await db.exe('getPermissionOptions', []);
    this.permissionOptionMap.clear();
    for (const row of optionPermRows) {
      if (row.role) {
        this._setOptionMapEntry(Security.optionKey(row.subsystem, row.option, row.role), true);
      }
      if (row.role_id) {
        this._setOptionMapEntry(Security.optionKey(row.subsystem, row.option, row.role_id), true);
      }
    }

    this.allOptions = await db.exe('getAllOptions', []);
    this.loaded = true;

    logger.info('Seguridad inicializada desde BD', {
      txCount: this.txMap.size,
      methodPermCount: this.permissionMethodMap.size,
      optionPermCount: this.permissionOptionMap.size,
    });
  }

  hasPermission(profiles, tx) {
    if (!profiles) return false;
    const txNum = Number(tx);
    if (!Number.isInteger(txNum) || txNum <= 0) return false;

    const txInfo = this.txMap.get(txNum);
    if (!txInfo) return false;

    const profileList = Array.isArray(profiles) ? profiles : [profiles];
    return profileList.some((p) => {
      const profileId = typeof p === 'object' && p !== null ? (p.role || p.roleId || p.profileId) : p;
      if (!profileId) return false;
      const key = Security.methodKey(txInfo.subsystem, txInfo.class, txInfo.method, profileId);
      return this.getPermissionMethod(key);
    });
  }

  getAllowedOptions(profiles) {
    if (!profiles) return [];
    const profileList = Array.isArray(profiles) ? profiles : [profiles];
    const allowed = [];

    for (const opt of this.allOptions) {
      const ok = profileList.some((p) => {
        const profileId = typeof p === 'object' && p !== null ? (p.role || p.roleId || p.profileId) : p;
        if (!profileId) return false;
        const key = Security.optionKey(opt.subsystem, opt.option, profileId);
        return this.getPermissionOption(key);
      });
      if (ok) {
        allowed.push({ subsystem: opt.subsystem, option: opt.option });
      }
    }
    return allowed;
  }

  async executeMethod(jsonData, context = {}) {
    const txNum = Number(jsonData?.tx);
    if (!Number.isInteger(txNum) || txNum <= 0) {
      throw new ValidationError('El código de transacción (tx) debe ser un entero positivo');
    }

    const txInfo = this.txMap.get(txNum);
    if (!txInfo) {
      throw new NotFoundError(`Transacción ${txNum} no registrada`);
    }

    const { instance, method, subsystem, class: className } = txInfo;
    if (!instance || typeof instance[method] !== 'function') {
      throw new NotFoundError(`El método '${method}' de ${subsystem}/${className} aún no está implementado`);
    }

    const params = Array.isArray(jsonData.params)
      ? jsonData.params
      : (jsonData.params !== undefined ? [jsonData.params] : []);

    return await instance[method](...params, context);
  }
}

module.exports = new Security();
