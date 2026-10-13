'use strict';
// Uso: node scripts/add-profile.js <usuario> <ROLE_CODE> "<Nombre perfil>"
// Agrega un perfil (rol) más a un usuario que ya existe. Roles base: ADMIN, PAYROLL_MANAGER, EMPLOYEE.
const { createAuth } = require('../src');

(async () => {
  const [username, roleCode, displayName] = process.argv.slice(2);
  if (!username || !roleCode || !displayName) {
    console.error('Uso: node scripts/add-profile.js <usuario> <ROLE_CODE> "<Nombre perfil>"');
    process.exit(1);
  }
  const { db, userRepository } = createAuth();
  try {
    const user = await userRepository.findByUsername(username);
    if (!user) throw new Error(`El usuario "${username}" no existe`);

    const role = await db.one('SELECT 1 FROM role WHERE code = $1', [roleCode]);
    if (!role) {
      const roles = (await db.query('SELECT code FROM role ORDER BY code')).map((r) => r.code).join(', ');
      throw new Error(`El rol "${roleCode}" no existe. Roles disponibles: ${roles}`);
    }

    const profile = await userRepository.addProfile({ userId: user.id, roleCode, displayName });
    console.log(`Perfil ${profile.id} (${roleCode} - "${displayName}") agregado a ${user.username}`);
  } catch (e) {
    console.error('Error:', e.message);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
})();
