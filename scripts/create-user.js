'use strict';
const { createAuth, PasswordHasher } = require('../src');

(async () => {
  const [username, password, roleCode, displayName] = process.argv.slice(2);
  if (!username || !password || !roleCode || !displayName) {
    console.error('Uso: node scripts/create-user.js <usuario> <contraseña> <ROLE_CODE> "<Nombre perfil>"');
    process.exit(1);
  }
  const { db, userRepository } = createAuth();
  let user = null;
  try {
    const role = await db.one('SELECT 1 FROM role WHERE code = $1', [roleCode]);
    if (!role) {
      const roles = (await db.query('SELECT code FROM role ORDER BY code')).map((r) => r.code).join(', ');
      throw new Error(`El rol "${roleCode}" no existe. Roles disponibles: ${roles}`);
    }
    user = await userRepository.create({ username, passwordHash: PasswordHasher.hash(password) });
    const profile = await userRepository.addProfile({ userId: user.id, roleCode, displayName });
    console.log(`Usuario ${user.username} (id ${user.id}) creado con perfil ${profile.id}`);
  } catch (e) {
    if (user) await db.query('DELETE FROM app_user WHERE id = $1', [user.id]).catch(() => {});
    console.error('Error:', e.code === '23505' ? `El usuario "${username}" ya existe` : e.message);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
})();
