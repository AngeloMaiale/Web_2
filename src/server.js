'use strict';
const createApp = require('./app');
const { createAuth } = require('./index');

const PORT = Number(process.env.PORT) || 3000;
const { auth, db } = createAuth();
const app = createApp({ authService: auth });

const server = app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(` Servidor de Nómina (Sesiones Express) iniciado`);
  console.log(` URL: http://localhost:${PORT}`);
  console.log(`======================================================`);
  console.log(`Endpoints disponibles:`);
  console.log(`  POST /api/auth/login        - Iniciar sesión (valida BD y crea cookie)`);
  console.log(`  GET  /api/auth/session      - Consultar sesión actual y cookies`);
  console.log(`  POST /api/auth/logout       - Destruir sesión y limpiar cookies`);
  console.log(`======================================================\n`);
});

async function shutdown() {
  console.log('\nCerrando servidor HTTP y conexiones de base de datos...');
  server.close(async () => {
    try {
      await db.close();
      console.log('Conexión con PostgreSQL cerrada. Salida limpia.');
    } catch (e) {
      console.error('Error al cerrar base de datos:', e);
    }
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
