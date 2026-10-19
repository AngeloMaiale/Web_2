'use strict';
const path = require('path');
const express = require('express');
const session = require('express-session');
const ExpressSession = require('./session/ExpressSession');
const authRoutes = require('./routes/authRoutes');

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

app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
