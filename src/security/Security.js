'use strict';
const path = require('path');
const db = require('../db/Database');

class Security {
  constructor() {
    this.permissionMethodMap = new Map();
  }

  static key(subsystem, className, method, role) {
    return `${subsystem}_${className}_${method}_${role}`;
  }

  async loadPermission() {
    const rows = await db.query(
      `SELECT s.code AS subsystem, c.code AS class, m.code AS method, r.code AS role
         FROM permission_method pm
         JOIN method m    ON m.id = pm.method_id
         JOIN class c     ON c.id = m.class_id
         JOIN subsystem s ON s.id = c.subsystem_id
         JOIN role r      ON r.id = pm.role_id`
    );
    this.permissionMethodMap.clear();
    for (const row of rows) {
      this.permissionMethodMap.set(Security.key(row.subsystem, row.class, row.method, row.role), true);
    }
  }

  getPermissionMethod(key) {
    return this.permissionMethodMap.get(key) === true;
  }

  hasPermission(profiles, jsonData) {
    return profiles.some((p) =>
      this.getPermissionMethod(Security.key(jsonData.subsystem, jsonData.class, jsonData.method, p.role)));
  }

  async executeMethod(jsonData) {
    const BusinessObject = require(path.join(__dirname, '../bo', jsonData.subsystem, jsonData.class));
    const instance = new BusinessObject();
    return instance[jsonData.method](...(jsonData.params || []));
  }
}

module.exports = new Security();
