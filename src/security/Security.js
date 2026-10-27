'use strict';
const path = require('path');
const db = require('../db/Database');

class Security {
  constructor() {
    this.permissionMethodMap = new Map();
    this.permissionOptionMap = new Map();
    // Mapa de transacciones (TX): txId -> { subsystem, class, method, instance }
    this.txMap = new Map();
    // Mapa inverso para soporte por nombre: "subsystem_class_method" -> txId
    this.methodToTxMap = new Map();
  }

  // Clave para métodos: subsystem_de + "_" + Object_de + "_" + Method_de + "_" + profile_id (Foto 1)
  static methodKey(subsystem_de, object_de, method_de, profile_id) {
    return `${subsystem_de}_${object_de}_${method_de}_${profile_id}`;
  }

  // Clave para opciones: subsystem_de + "_" + Option_det + "_" + profile_id (Foto 9)
  static optionKey(subsystem_de, option_det, profile_id) {
    return `${subsystem_de}_${option_det}_${profile_id}`;
  }

  getPermissionMethod(key) {
    return this.permissionMethodMap.get(key) === true;
  }

  getPermissionOption(key) {
    return this.permissionOptionMap.get(key) === true;
  }

  setPermissionMethod(value) {
    if (typeof value === 'object' && value !== null) {
      this.permissionMethodMap.set(value.key, value.value !== false);
    } else {
      this.permissionMethodMap.set(String(value), true);
    }
  }

  setPermissionOption(value) {
    if (typeof value === 'object' && value !== null) {
      this.permissionOptionMap.set(value.key, value.value !== false);
    } else {
      this.permissionOptionMap.set(String(value), true);
    }
  }

  // Carga de todos los métodos de los BO, creación de txMap y mapas de permisos desde el .yaml
  async loadPermission() {
    console.log('[Security] Cargando métodos de BOs y permisos desde sentences.yaml...');

    // 1. Cargar todos los métodos de los BOs desde el archivo YAML
    let methods = [];
    try {
      methods = await db.exe('getAllBOMethods', []);
    } catch (err) {
      console.warn('[Security] No se pudieron cargar los métodos de BO:', err.message);
    }

    this.txMap.clear();
    this.methodToTxMap.clear();

    for (const row of methods) {
      const tx = Number(row.tx);
      const subsystem = row.subsystem;
      const className = row.class;
      const method = row.method;

      try {
        const boPath = path.join(__dirname, '../bo', subsystem, className);
        const BOClass = require(boPath);
        const instance = new BOClass();

        const txEntry = {
          tx,
          subsystem,
          class: className,
          method,
          instance,
        };

        this.txMap.set(tx, txEntry);
        this.methodToTxMap.set(`${subsystem}_${className}_${method}`, tx);
      } catch (err) {
        console.error(`[Security] Error instanciando BO para tx ${tx} (${subsystem}/${className}):`, err.message);
      }
    }

    // 2. Cargar permisos de métodos requeridos por perfil/rol desde el archivo YAML
    let methodPermRows = [];
    try {
      methodPermRows = await db.exe('getPermissionMethods', []);
    } catch (err) {
      console.warn('[Security] No se pudieron cargar permisos de métodos:', err.message);
    }

    this.permissionMethodMap.clear();
    for (const row of methodPermRows) {
      // Clave exacta: subsystem_de + "_" + Object_de + "_" + Method_de + "_" + profile_id
      if (row.role) {
        const keyRole = Security.methodKey(row.subsystem, row.class, row.method, row.role);
        this.setPermissionMethod(keyRole);
      }
      if (row.role_id) {
        const keyId = Security.methodKey(row.subsystem, row.class, row.method, row.role_id);
        this.setPermissionMethod(keyId);
      }
    }

    // 3. Cargar permisos de opciones desde el archivo YAML (si la tabla existe)
    let optionPermRows = [];
    try {
      optionPermRows = await db.exe('getPermissionOptions', []);
    } catch (err) {
      // Opcional si aún no está creada la tabla de opciones
    }

    this.permissionOptionMap.clear();
    for (const row of optionPermRows) {
      if (row.role) {
        const keyRole = Security.optionKey(row.subsystem, row.option, row.role);
        this.setPermissionOption(keyRole);
      }
      if (row.role_id) {
        const keyId = Security.optionKey(row.subsystem, row.option, row.role_id);
        this.setPermissionOption(keyId);
      }
    }

    console.log(`[Security] Carga completa: ${this.txMap.size} transacciones registradas, ${this.permissionMethodMap.size} permisos cargados.`);
  }

  // Verifica si los perfiles del usuario tienen permiso sobre la transacción o método
  hasPermission(profiles, target) {
    if (!profiles) return false;
    const profileList = Array.isArray(profiles) ? profiles : [profiles];

    // Obtener información de la transacción
    let txInfo = null;
    if (typeof target === 'object' && target !== null) {
      if (target.tx !== undefined && target.tx !== null) {
        txInfo = this.txMap.get(Number(target.tx));
      } else if (target.subsystem && target.class && target.method) {
        const tx = this.methodToTxMap.get(`${target.subsystem}_${target.class}_${target.method}`);
        txInfo = tx ? this.txMap.get(tx) : target;
      }
    }

    if (!txInfo) return false;

    // Validar si al menos uno de los perfiles tiene el permiso requerido
    return profileList.some((p) => {
      const profileId = typeof p === 'object' ? (p.role || p.roleId || p.profileId) : p;
      const key = Security.methodKey(txInfo.subsystem, txInfo.class, txInfo.method, profileId);
      return this.getPermissionMethod(key);
    });
  }

  // Ejecución segura del método asociado a la transacción (escondiendo el nombre del método)
  async executeMethod(jsonData) {
    let txInfo = null;

    if (jsonData.tx !== undefined && jsonData.tx !== null) {
      txInfo = this.txMap.get(Number(jsonData.tx));
    } else if (jsonData.subsystem && jsonData.class && jsonData.method) {
      const tx = this.methodToTxMap.get(`${jsonData.subsystem}_${jsonData.class}_${jsonData.method}`);
      if (tx) {
        txInfo = this.txMap.get(tx);
      } else {
        const boPath = path.join(__dirname, '../bo', jsonData.subsystem, jsonData.class);
        const BOClass = require(boPath);
        txInfo = { instance: new BOClass(), method: jsonData.method };
      }
    }

    if (!txInfo) {
      throw new Error(`Transacción no encontrada: ${jsonData.tx || jsonData.method}`);
    }

    const { instance, method } = txInfo;
    if (!instance || typeof instance[method] !== 'function') {
      throw new Error(`El método '${method}' no existe en el Business Object.`);
    }

    const params = Array.isArray(jsonData.params)
      ? jsonData.params
      : (jsonData.params !== undefined ? [jsonData.params] : []);

    return await instance[method](...params);
  }
}

module.exports = new Security();
