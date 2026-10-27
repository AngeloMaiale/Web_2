'use strict';
const path = require('path');
const express = require('express');
const session = require('express-session');
const ExpressSession = require('./session/ExpressSession');
const authRoutes = require('./routes/authRoutes');
const security = require('./security/Security');

const PORT = Number(process.env.PORT) || 3000;
const app = express();

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'nomina-secreto-dev',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 },
}));

app.use((req, res, next) => {
  req.userSession = new ExpressSession(req);
  next();
});

app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/api/auth', authRoutes);

// Endpoint centralizado para procesar transacciones (Fotos 6 y 7)
// Sin carpetas middleware: todo integrado directamente en la ruta
const processHandler = async (req, resp) => {
  // 1. //tiene session
  if (!req.userSession.hasSession()) {
    return resp.status(401).json({ ok: false, error: 'Debe iniciar sesión' });
  }

  const profiles = req.session.userData?.profile || req.session.user?.profile;

  // 2. //tiene permiso
  if (!security.hasPermission(profiles, req.body)) {
    return resp.status(403).json({ ok: false, error: 'No tiene permiso para ejecutar esta acción' });
  }

  // 3. //ejecuto el metodo
  try {
    const data = await security.executeMethod(req.body);
    resp.json({ ok: true, data });
  } catch (err) {
    console.error('[toProcess] Error al ejecutar:', err.message);
    resp.status(500).json({ ok: false, error: 'Error al ejecutar el método' });
  }
};

// Se habilita tanto en /api/toProcess como en /toProcess
app.post('/api/toProcess', processHandler);
app.post('/toProcess', processHandler);

// Endpoint auxiliar para que la interfaz conozca las TX disponibles según los permisos del usuario
app.get('/api/txList', (req, res) => {
  if (!req.userSession.hasSession()) {
    return res.status(401).json({ ok: false, error: 'No autenticado' });
  }
  const profiles = req.session.userData?.profile || req.session.user?.profile;
  const list = [];
  for (const [tx, info] of security.txMap.entries()) {
    if (security.hasPermission(profiles, { tx })) {
      list.push({ tx, subsystem: info.subsystem, class: info.class, method: info.method });
    }
  }
  res.json({ ok: true, list });
});

// Apenas el server empiece a escuchar el puerto, se cargan los métodos de los BO y los mapas de permisos y TX
app.listen(PORT, async () => {
  console.log(`Servidor en http://localhost:${PORT}`);
  try {
    await security.loadPermission();
  } catch (err) {
    console.error('Error cargando seguridad en el inicio:', err.message);
  }
});
