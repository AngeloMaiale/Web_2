# Guía de integración: login + objeto de sesión

Para quienes hacen el **servidor** y el **frontend**. La capa de base de datos ya está lista en `src/`; ustedes solo la llaman.

## 1. Preparar el entorno (una vez por persona)

1. Crear una base de datos en Postgres (ej. `nomina`).
2. Ejecutar, en este orden:
   ```bash
   psql -d nomina -f db/schema.sql
   psql -d nomina -f db/auth_schema.sql
   ```
3. Copiar `.env.example` a `.env` y ajustar `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`. Si usan `dotenv` o similar, cárguenlo **antes** de llamar a `createAuth()`.
4. `npm install`
5. Crear un usuario de prueba:
   ```bash
   npm run create-user -- maria Clave123 ADMIN "María Admin"
   ```
   Roles disponibles: `ADMIN`, `PAYROLL_MANAGER`, `EMPLOYEE`. Para dar más perfiles al mismo usuario, usar `userRepository.addProfile({ userId, roleCode, displayName })`.

## 2. Flujo completo

```
Frontend                      Servidor                          Base de datos
   |  -- (conecta) ---------->  |                                     |
   |  <-- pide/valida token --  |  auth.getSession(token) ----------> | user_session
   |        ¿hay sesión?        |  <-- SessionObject | null           |
   |  SÍ: continúa              |                                     |
   |  NO: muestra login         |                                     |
   |  -- login(user, pass) ---> |  auth.login(user, pass) ----------> | app_user, user_session
   |  <-- session | error ----- |  <-- SessionObject | AuthError      |
   |  guarda token              |                                     |
   |  -- logout(token) -------> |  auth.logout(token) --------------> | borra la sesión
```

Regla de oro: **el servidor es quien decide** si hay sesión. El frontend solo guarda el `token` y lo envía.

## 3. API que ofrece la capa de datos

```js
const { createAuth, AuthError, ValidationError } = require('./src');
const { auth, db } = createAuth();   // crear UNA sola vez al arrancar el servidor
```

| Llamada | Devuelve | Errores |
|---|---|---|
| `await auth.login(username, password)` | `SessionObject` | `ValidationError` (campos vacíos/largos), `AuthError` ("Usuario o contraseña incorrectos") |
| `await auth.getSession(token)` | `SessionObject` o `null` | — |
| `await auth.logout(token)` | — | — |
| `await db.close()` | — | llamar al apagar el servidor |

### Forma del objeto de sesión (lo que recibe el frontend)

```json
{
  "userId": 1,
  "username": "maria",
  "profile": [
    { "profileId": 1, "role": "ADMIN", "roleName": "Administrador",
      "displayName": "María Admin", "companyId": null, "employeeId": null, "data": {} },
    { "profileId": 2, "role": "EMPLOYEE", "roleName": "Trabajador",
      "displayName": "María Trabajadora", "companyId": null, "employeeId": null, "data": {} }
  ],
  "token": "3162ae17…",
  "expiresAt": "2026-10-12T02:55:12.515Z"
}
```

`session.hasRole('ADMIN')` sirve en el servidor para autorizar acciones. La contraseña y su hash **nunca** salen de la capa de datos.

## 4. Servidor: manejar los mensajes

Cada mensaje del cliente es `{ type, payload }`; la respuesta es `{ type, ok, data | error }`. Esto es independiente de la librería de sockets: adapten `send(...)` a la que usen.

```js
const { createAuth, AuthError, ValidationError } = require('./src');
const { auth } = createAuth();

// handle(msg, socketState, send): socketState es un objeto por conexión, ej. {}
async function handle(msg, state, send) {
  try {
    switch (msg.type) {
      case 'session:check': {
        const s = await auth.getSession(msg.payload?.token);
        if (s) state.session = s;
        return send({ type: 'session:check', ok: !!s, data: s });   // data = null => mostrar login
      }
      case 'auth:login': {
        const { username, password } = msg.payload || {};
        state.session = await auth.login(username, password);
        return send({ type: 'auth:login', ok: true, data: state.session });
      }
      case 'auth:logout': {
        if (state.session) await auth.logout(state.session.token);
        state.session = null;
        return send({ type: 'auth:logout', ok: true });
      }
      default: {
        // Todo lo demás exige sesión
        if (!state.session) return send({ type: msg.type, ok: false, error: 'No autenticado' });
        // ... aquí van las demás funciones del sistema
      }
    }
  } catch (e) {
    if (e instanceof AuthError || e instanceof ValidationError) {
      return send({ type: msg.type, ok: false, error: e.message });   // mensaje seguro para mostrar
    }
    console.error(e);
    send({ type: msg.type, ok: false, error: 'Error interno' });       // no filtrar detalles
  }
}
```

Con WebSocket plano (`ws`) o Socket.IO solo cambia cómo se recibe y envía: `JSON.parse` al recibir, `JSON.stringify` al enviar.

## 5. Frontend: lógica mínima

```js
const saved = localStorage.getItem('token');

socket.onopen = () => {
  if (saved) send({ type: 'session:check', payload: { token: saved } });
  else showLogin();
};

function onMessage(msg) {
  switch (msg.type) {
    case 'session:check':
      msg.ok ? showApp(msg.data) : (localStorage.removeItem('token'), showLogin());
      break;
    case 'auth:login':
      if (msg.ok) { localStorage.setItem('token', msg.data.token); showApp(msg.data); }
      else showError(msg.error);              // "Usuario o contraseña incorrectos"
      break;
    case 'auth:logout':
      localStorage.removeItem('token'); showLogin();
      break;
  }
}
```

Validación en el frontend (comodidad, no seguridad; el servidor valida de nuevo): usuario y contraseña no vacíos; usuario ≤ 100 y contraseña ≤ 200 caracteres.

Si el usuario tiene varios perfiles (`session.profile.length > 1`), el frontend puede mostrar un selector y guardar el perfil activo en su estado local.

## 6. Reparto sugerido y orden de trabajo

| Quién | Entregable | Depende de |
|---|---|---|
| BD (tú) | `db/*.sql`, `src/` ✔ listo | — |
| Servidor | `handle()` + conexión de sockets, sección 4 | `src/` |
| Frontend | Pantalla de login, pantalla principal, sección 5 | Contrato de mensajes (sección 4) |

Orden recomendado: (1) todos preparan el entorno; (2) servidor y frontend acuerdan los nombres de mensajes de la sección 4 (ya propuestos); (3) servidor prueba `auth:login` con un cliente simple; (4) frontend conecta; (5) probar la lista de abajo.

## 7. Lista de pruebas de aceptación

- [ ] Sin token guardado: aparece el login.
- [ ] Credenciales correctas: aparece la app con `username` y los perfiles.
- [ ] Contraseña incorrecta y usuario inexistente: mismo mensaje "Usuario o contraseña incorrectos".
- [ ] Campos vacíos: mensaje de campos obligatorios.
- [ ] Recargar la página con token válido: continúa sin pedir login.
- [ ] Logout: vuelve al login y el token viejo ya no sirve.
- [ ] Token expirado o inventado: vuelve al login.
- [ ] Usuario con dos perfiles: ambos aparecen en `profile[]`.

## 8. Notas y limitaciones

- **HTTPS/WSS** en cualquier entorno real: el login envía la contraseña en claro por el canal.
- Usar `localStorage` para el token es lo más simple; es vulnerable a XSS. Aceptable para este alcance.
- No hay bloqueo por intentos fallidos ni renovación del token; son mejoras futuras.
- Se puede limpiar sesiones vencidas con `sessionRepository.deleteExpired()` (por ejemplo al arrancar el servidor).
- Los ids numéricos llegan como `number`. `data` de cada perfil es JSON libre.
- No usé "Lib-Socket-Cli" ni "RDBM ID-Port" porque no conozco su interfaz; si imponen una forma de manejar eventos, el contrato de la sección 4 se adapta sin tocar `src/`.
