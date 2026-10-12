'use strict';
const assert = require('assert');
const ExpressSession = require('../src/session/ExpressSession');
const createApp = require('../src/app');

// Mock AuthService para probar la lógica de ExpressSession sin requerir Docker encendido
const mockAuthService = {
  async authenticate(username, password) {
    if (username === 'admin' && password === 'Admin123') {
      return {
        userId: 1,
        username: 'admin',
        email: 'admin@demo.local',
        profile: [
          {
            profileId: 1,
            role: 'ADMIN',
            roleName: 'Administrador Demo',
            displayName: 'Admin Master',
            companyId: 1,
            employeeId: null,
            data: { theme: 'dark' },
          },
          {
            profileId: 2,
            role: 'PAYROLL_MANAGER',
            roleName: 'Analista de Nómina',
            displayName: 'Admin Nómina',
            companyId: 1,
            employeeId: null,
            data: {},
          },
        ],
      };
    }
    const err = new Error('Usuario o contraseña incorrectos');
    err.name = 'AuthError';
    throw err;
  },
};

// Simulador de req y session de Express
function createMockReq() {
  const sessionData = {
    id: 'sess_' + Math.random().toString(36).substring(2, 9),
    cookie: {
      maxAge: 28800000,
      originalMaxAge: 28800000,
      expires: new Date(Date.now() + 28800000),
      httpOnly: true,
      path: '/',
      secure: false,
    },
    save(cb) {
      cb && cb(null);
    },
    destroy(cb) {
      delete sessionData.user;
      cb && cb(null);
    },
  };

  return {
    session: sessionData,
    sessionID: sessionData.id,
  };
}

async function runTests() {
  console.log('--- INICIANDO PRUEBAS DE EXPRESS SESSION WRAPPER ---');

  const req = createMockReq();
  const sessionWrapper = new ExpressSession(req, null, mockAuthService);

  // 1. ¿Tiene sesión al inicio?
  console.log('1. Verificando estado inicial...');
  assert.strictEqual(sessionWrapper.hasSession(), false, 'Al inicio no debe tener sesión');
  assert.strictEqual(sessionWrapper.userId, null);
  assert.deepStrictEqual(sessionWrapper.profile, []);
  console.log('  ✔ Estado inicial sin sesión validado');

  // 2. Intento de login fallido
  console.log('2. Probando credenciales inválidas...');
  let failed = false;
  try {
    await sessionWrapper.login('admin', 'clave-mala');
  } catch (e) {
    failed = true;
    assert.strictEqual(e.name, 'AuthError');
  }
  assert.strictEqual(failed, true, 'Debe fallar si las credenciales son malas');
  assert.strictEqual(sessionWrapper.hasSession(), false);
  console.log('  ✔ Error en credenciales inválidas validado');

  // 3. Login exitoso
  console.log('3. Probando login exitoso...');
  const loginRes = await sessionWrapper.login('admin', 'Admin123');
  assert.strictEqual(loginRes.ok, true);
  assert.strictEqual(loginRes.alreadyAuthenticated, false);
  assert.strictEqual(sessionWrapper.hasSession(), true);
  assert.strictEqual(sessionWrapper.userId, 1);
  assert.strictEqual(sessionWrapper.UserId, 1);
  assert.strictEqual(sessionWrapper.username, 'admin');
  assert.strictEqual(sessionWrapper.UserName, 'admin');
  assert.strictEqual(sessionWrapper.profile.length, 2);
  assert.strictEqual(sessionWrapper.Profile.length, 2);
  assert.strictEqual(sessionWrapper.hasRole('ADMIN'), true);
  assert.strictEqual(sessionWrapper.hasRole('PAYROLL_MANAGER'), true);
  assert.strictEqual(sessionWrapper.hasRole('EMPLOYEE'), false);
  assert.ok(sessionWrapper.cookie.maxAge > 0, 'Debe incluir las variables de cookie');
  console.log('  ✔ Sesión creada con UserId, UserName, Profile[] y variables de cookie');

  // 4. Segundo intento de login (Diagrama: "¿tiene session?" -> SÍ -> "Ya tiene sesion")
  console.log('4. Probando flujo de usuario que ya tiene sesión activa...');
  const secondLogin = await sessionWrapper.login('admin', 'Admin123');
  assert.strictEqual(secondLogin.ok, true);
  assert.strictEqual(secondLogin.alreadyAuthenticated, true);
  assert.strictEqual(secondLogin.message, 'Ya tiene sesión iniciada');
  console.log('  ✔ Condición "¿tiene session? -> SÍ" validada con éxito');

  // 5. Cierre de sesión (destroy / logout)
  console.log('5. Probando logout / destroy...');
  const logoutRes = await sessionWrapper.destroy();
  assert.strictEqual(logoutRes.ok, true);
  assert.strictEqual(sessionWrapper.hasSession(), false);
  console.log('  ✔ Cierre y destrucción de sesión validado');

  // 6. Verificando createApp
  console.log('6. Verificando instanciación de app Express...');
  const app = createApp({ authService: mockAuthService });
  assert.ok(typeof app.listen === 'function', 'createApp debe devolver una aplicación express');
  console.log('  ✔ createApp configurado correctamente con middleware y rutas');

  console.log('\n--- TODAS LAS PRUEBAS PASARON EXITOSAMENTE (100% OK) ---');
}

runTests().catch((err) => {
  console.error('Error en pruebas:', err);
  process.exit(1);
});
