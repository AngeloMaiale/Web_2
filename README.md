# Sistema de Nómina (Venezuela) – Aplicación Completa (Frontend, Backend y BD)

Sistema completo de nómina y autenticación con PostgreSQL, servidor Express (manejo de sesiones con cookies y wrapper propio) y frontend web integrado.

---

## 🏗️ Arquitectura y Cómo se Conecta Todo

```
 Navegador (Frontend)                    Servidor (Express)                   Contenedor Docker (PostgreSQL)
 [http://localhost:3000]                 [Node.js en Host]                     [nomina-db]
        |                                       |                                         |
        | -- fetch('/api/auth/login') --------> |                                         |
        |    { username, password }             | -- TCP (localhost:5433) --------------> |
        |                                       |    Pool pg consulta app_user, roles     |
        |                                       | <-- Devuelve usuario y perfiles ------- |
        |                                       |                                         |
        |                                       | Crea ExpressSession:                    |
        |                                       | - req.session.user = { UserId, ... }    |
        |                                       | - Genera cookie 'connect.sid'           |
        |                                       |                                         |
        | <-- Responde { ok: true, session } -- |                                         |
        |     + Set-Cookie: connect.sid         |                                         |
```

### ¿Cómo extrae Node.js la info de la BD si está dentro de un contenedor?

Aunque PostgreSQL esté corriendo en un entorno aislado dentro de Docker, la conexión funciona gracias al **Mapeo de Puertos (Port Forwarding)**:

1. **El puerto dentro del contenedor:** Postgres escucha internamente en su puerto estándar `5432`.
2. **El mapeo en `docker-compose.yml` (`5433:5432`):** Docker le indica al sistema operativo del host (tu máquina Windows): *"Cualquier conexión TCP que llegue a mi puerto local `5433`, reenvíala de forma transparente al puerto `5432` dentro del contenedor `nomina-db`"*.
3. **El cliente de Node.js (`src/db/Database.js`):** La librería `pg` abre un socket TCP contra `localhost:5433` usando las credenciales (`nomina` / `nomina`).
4. **La red puente de Docker (Bridge):** Docker intercepta los paquetes en el puerto 5433, los traslada a la red interna virtual del contenedor y Postgres los procesa como si fuera una conexión de red normal.

---

## 🚀 Guía Rápida: Cómo Ejecutar Todo el Proyecto

### 1. Iniciar la Base de Datos (Docker)
Requisitos: Tener **Docker Desktop** abierto.

```bash
docker compose up -d --build --wait
```
* La base de datos queda levantada en `localhost:5433`.
* Carga automáticamente el esquema (`db/schema.sql`, `db/auth_schema.sql`) y los datos de prueba (`db/seed_dev.sql`).
* Usuario demo precargado: **`admin`** / contraseña: **`Admin123`** (con roles `ADMIN` y `PAYROLL_MANAGER`).

### 2. Instalar dependencias
```bash
npm install
```

### 3. Iniciar el Servidor Web
```bash
npm start
```
El servidor arrancará en: **[http://localhost:3000](http://localhost:3000)**

### 4. Abrir la Aplicación en el Navegador
Abre en tu navegador:
👉 **`http://localhost:3000`**

Verás la interfaz gráfica de Nómina:
* **Login:** Ingresa `admin` y `Admin123`.
* **Panel de Usuario:** El frontend se comunicará vía HTTP `fetch` con el backend, recibirá los datos del usuario autenticado, mostrará los perfiles disponibles para seleccionar y la fecha de expiración de la sesión.
* **Cerrar Sesión:** Presiona "Cerrar sesión" para invalidar la cookie y volver al login.

---

## 🔌 Endpoints de la API (`/api/auth`)

Todas las rutas manejan cookies de sesión automáticamente (`credentials: 'include'`):

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/auth/login` | Inicia sesión. Si ya tiene sesión activa, devuelve la actual. Si no, valida credenciales en BD y crea `req.session.user`. |
| `GET` | `/api/auth/session` | Consulta si la sesión actual está activa y devuelve los datos del usuario (`UserId`, `UserName`, `Profile[]`) y de la cookie. |
| `POST` | `/api/auth/logout` | Destruye la sesión en el servidor y limpia la cookie en el navegador. |
| `GET` | `/api/auth/me` | Ruta protegida de prueba (requiere sesión activa vía middleware `requireSession`). |
| `GET` | `/api/auth/admin-check` | Ruta protegida por rol (requiere rol `ADMIN` vía middleware `requireRole('ADMIN')`). |

---

## 🧪 Pruebas Automatizadas

Puedes verificar toda la lógica del wrapper de sesión y los flujos sin depender de Docker:
```bash
node scripts/test-session-flow.js
```

---

## 🛑 Comandos Útiles de Docker

| Acción | Comando |
|---|---|
| Detener la base de datos conservando datos | `docker compose down` |
| Reiniciar la base de datos desde cero (borrar volumen) | `docker compose down -v && docker compose up -d --build --wait` |
| Ver estado del contenedor | `docker compose ps` |

---

## 📚 Documentación Adicional

- [Modelo de datos y legislación venezolana](docs/modelo-de-datos.md)
- [Guía técnica de integración](docs/guia-integracion.md)
