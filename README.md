# Sistema de Nómina (Venezuela) – Base de datos y sesión

Esquema PostgreSQL de nómina y capa de acceso a datos (Node.js + `pg`) para login y objeto de sesión.

## Base de datos en Docker

Requisitos: Docker Desktop y Node.js. No hace falta instalar Postgres ni configurar credenciales.

```bash
docker compose up -d --build --wait   # levanta la BD con esquema y datos demo
npm install
```

- Host: `localhost:5433` · usuario / clave / base: `nomina` (solo desarrollo). `src/` ya apunta ahí por defecto.
- Usuario demo: `admin` / `Admin123` (perfiles `ADMIN` y `PAYROLL_MANAGER`).
- Si el puerto 5433 está ocupado: `NOMINA_DB_PORT=5434 docker compose up -d` y usar `PGPORT=5434` al correr Node.

### Cerrar el proceso

Todos los comandos desde la raíz del proyecto.

| Objetivo | Comando |
|---|---|
| Detener y **conservar** los datos (lo normal al terminar) | `docker compose down` |
| Detener y **borrar** los datos (reinicio de cero) | `docker compose down -v` |
| Solo pausar, sin quitar el contenedor | `docker compose stop` / `docker compose start` |
| Borrar también la imagen construida | `docker compose down -v --rmi local` |
| Ver qué está corriendo | `docker compose ps` |

Si se levantó en primer plano (sin `-d`): `Ctrl+C` y luego `docker compose down`. También se puede parar `nomina-db` desde Docker Desktop.

### Reiniciar la BD de cero

```bash
docker compose down -v && docker compose up -d --build --wait
```

Los scripts de `db/` solo se ejecutan al crear el volumen: tras cambiar el esquema, cada quien debe hacer este reinicio.

## Servidor de Sesiones (Express)

El proyecto incluye un servidor Express con un objeto de sesión propio (`ExpressSession`) que implementa y envuelve `express-session`, manejando `UserId`, `UserName`, `Profile[]` y las variables de cookies.

### Iniciar el servidor
```bash
npm start   # corre en http://localhost:3000
```

### Endpoints disponibles
- **`POST /api/auth/login`**: Valida credenciales contra la BD.
  - Si ya tiene sesión activa: responde que ya tiene sesión iniciada (`alreadyAuthenticated: true`).
  - Si no tiene sesión: valida usuario/contraseña y crea la sesión en Express con sus perfiles y cookie.
- **`GET /api/auth/session`**: Retorna el estado actual de la sesión, datos de usuario y parámetros de cookie (`maxAge`, `expires`, etc.).
- **`POST /api/auth/logout`**: Cierra la sesión en el servidor y limpia la cookie del cliente.
- **`GET /api/auth/me`**: Ruta protegida por middleware `requireSession`.
- **`GET /api/auth/admin-check`**: Ruta protegida por rol (requiere `ADMIN`).

### Pruebas del flujo de sesión
Puedes ejecutar la prueba automatizada que valida el flujo completo (login, verificación de sesión previa, roles y logout):
```bash
node scripts/test-session-flow.js
```

## Documentación

- [Modelo de datos](docs/modelo-de-datos.md)
- [Guía de integración (login, sockets y Express Session)](docs/guia-integracion.md)
