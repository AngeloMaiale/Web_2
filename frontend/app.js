'use strict';

const API = '/api/auth';
const $ = (id) => document.getElementById(id);

let txCatalog = {
  listar: 1,
  crear: 2
};

async function loadTxCatalog() {
  try {
    const res = await fetch('/api/txList', { credentials: 'include' });
    const data = await res.json();
    if (data.ok && Array.isArray(data.list)) {
      data.list.forEach((item) => {
        txCatalog[item.method] = item.tx;
      });
    }
  } catch (err) {
    // Si no está disponible aún, usa los valores por defecto
  }
}

function showLogin(error = '') {
  $('app-view').classList.remove('active');
  $('login-view').classList.add('active');
  $('login-error').textContent = error;
  $('password').value = '';
}

function showApp(session) {
  $('login-view').classList.remove('active');
  $('app-view').classList.add('active');
  $('user-display').textContent = session.username;
  $('welcome-name').textContent = session.username;
  $('userid-display').textContent = session.userId;
  $('expires-display').textContent = new Date(session.expiresAt).toLocaleString();
  $('process-result').textContent = '';

  $('profiles-container').replaceChildren(...session.profile.map((p) => {
    const card = document.createElement('div');
    card.className = 'profile-card';
    card.innerHTML = '<h4></h4><div class="role-code"></div><div class="display-name"></div>';
    card.querySelector('h4').textContent = p.displayName;
    card.querySelector('.role-code').textContent = p.role;
    card.querySelector('.display-name').textContent = p.roleName;
    return card;
  }));

  loadTxCatalog();
}

function validate(username, password) {
  if (!username || !password) return 'Usuario y contraseña son obligatorios';
  if (username.length > 100 || password.length > 200) return 'Usuario o contraseña demasiado largos';
  return null;
}

async function api(path, method = 'GET', body) {
  const response = await fetch(API + path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return response.json();
}

$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = $('username').value.trim();
  const password = $('password').value;

  const error = validate(username, password);
  if (error) return showLogin(error);

  const data = await api('/login', 'POST', { username, password });
  data.ok ? showApp(data.session) : showLogin(data.error);
});

$('logout-btn').addEventListener('click', async () => {
  await api('/logout', 'POST');
  showLogin();
});

// Llamada mediante TX (Foto 7): oculta el nombre del método y de la clase
async function toProcess(action, params = []) {
  const tx = typeof action === 'number' ? action : (txCatalog[action] || action);
  const payload = typeof tx === 'number' ? { tx, params } : { method: action, params };

  const response = await fetch('/api/toProcess', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const resJson = await response.json();
  $('process-result').textContent =
    `HTTP ${response.status}\n` +
    `Payload enviado (oculta método): ${JSON.stringify(payload)}\n\n` +
    JSON.stringify(resJson, null, 2);
}

$('listar-btn').addEventListener('click', () => toProcess('listar'));
$('crear-btn').addEventListener('click', () =>
  toProcess('crear', [$('empresa-nombre').value.trim(), $('empresa-rif').value.trim()]));

api('/session').then((data) => (data.active ? showApp(data.session) : showLogin()));
