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

app.post('/api/toProcess', async (req, res) => {
  if (!req.userSession.hasSession()) {
    return res.status(401).json({ ok: false, error: 'Debe iniciar sesión' });
  }
  if (!security.hasPermission(req.session.user.profile, req.body)) {
    return res.status(403).json({ ok: false, error: 'No tiene permiso para ejecutar este método' });
  }
  try {
    const data = await security.executeMethod(req.body);
    res.json({ ok: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error al ejecutar el método' });
  }
});

security.loadPermission().then(() => {
  app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
});
