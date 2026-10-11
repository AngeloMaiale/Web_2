'use strict';
// Uso: node scripts/create-user.js <usuario> <contraseña> <ROLE_CODE> "<Nombre perfil>"
// Crea un usuario con un primer perfil. Roles base: ADMIN, PAYROLL_MANAGER, EMPLOYEE.
const { createAuth, PasswordHasher } = require('../src');

(async () => {
  const [username, password, roleCode, displayName] = process.argv.slice(2);
  if (!username || !password || !roleCode || !displayName) {
    console.error('Uso: node scripts/create-user.js <usuario> <contraseña> <ROLE_CODE> "<Nombre perfil>"');
    process.exit(1);
  }
  const { db, userRepository } = createAuth();
  try {
    const user = await userRepository.create({ username, passwordHash: PasswordHasher.hash(password) });
    const profile = await userRepository.addProfile({ userId: user.id, roleCode, displayName });
    if (!profile) throw new Error(`El rol ${roleCode} no existe`);
    console.log(`Usuario ${user.username} (id ${user.id}) creado con perfil ${profile.id}`);
  } catch (e) {
    console.error('Error:', e.message);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
})();
