'use strict';

const API_BASE = '/api/auth';

const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const loginForm = document.getElementById('login-form');
const loginSubmit = document.getElementById('login-submit');
const loginError = document.getElementById('login-error');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const userDisplay = document.getElementById('user-display');
const welcomeName = document.getElementById('welcome-name');
const profilesContainer = document.getElementById('profiles-container');
const profileSelection = document.getElementById('profile-selection');
const expiresDisplay = document.getElementById('expires-display');
const logoutButton = document.getElementById('logout-btn');
const connectionStatus = document.getElementById('connection-status');
const appConnectionStatus = document.getElementById('app-connection-status');
const retryButton = document.getElementById('retry-btn');

let currentSession = null;
let isSubmitting = false;

function setConnectionStatus(message, state = '') {
  connectionStatus.textContent = message;
  connectionStatus.dataset.state = state;
  appConnectionStatus.textContent = message;
  appConnectionStatus.dataset.state = state;
}

function showLogin() {
  loginView.classList.add('active');
  appView.classList.remove('active');
  loginError.textContent = '';
  usernameInput.value = '';
  passwordInput.value = '';
  loginSubmit.disabled = false;
  currentSession = null;
}

function showApp(session) {
  if (!session || typeof session.username !== 'string' || !Array.isArray(session.profile)) {
    showLogin();
    showError('El servidor devolvió una sesión inválida');
    return;
  }

  currentSession = session;
  loginView.classList.remove('active');
  appView.classList.add('active');
  userDisplay.textContent = session.username;
  welcomeName.textContent = session.username;

  const expirationDate = session.expiresAt || session.cookie?.expires;
  expiresDisplay.textContent = expirationDate
    ? new Date(expirationDate).toLocaleString()
    : 'No disponible';

  renderProfiles(session.profile);
}

function showError(message) {
  loginError.textContent = message;
}

function renderProfiles(profiles) {
  profilesContainer.replaceChildren();
  profileSelection.textContent = '';

  if (profiles.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'profile-selection';
    emptyMessage.textContent = 'No hay perfiles asignados a este usuario.';
    profilesContainer.appendChild(emptyMessage);
    return;
  }

  profiles.forEach((profile) => {
    const card = document.createElement('button');
    const title = document.createElement('h4');
    const roleCode = document.createElement('div');
    const displayName = document.createElement('div');

    card.type = 'button';
    card.className = 'profile-card';
    card.setAttribute('aria-pressed', 'false');
    title.textContent = profile.displayName || profile.roleName || 'Perfil';
    roleCode.className = 'role-code';
    roleCode.textContent = profile.role || '';
    displayName.className = 'display-name';
    displayName.textContent = profile.roleName || '';
    card.append(title, roleCode, displayName);

    card.addEventListener('click', () => {
      profilesContainer.querySelectorAll('.profile-card').forEach((profileCard) => {
        const selected = profileCard === card;
        profileCard.classList.toggle('selected', selected);
        profileCard.setAttribute('aria-pressed', String(selected));
      });
      profileSelection.textContent =
        `Perfil seleccionado: ${profile.displayName || profile.roleName || 'Perfil'}`;
    });

    profilesContainer.appendChild(card);
  });
}

async function checkSession() {
  retryButton.hidden = true;
  setConnectionStatus('Conectando con el servidor…');

  try {
    const response = await fetch(`${API_BASE}/session`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const data = await response.json();
    setConnectionStatus('Conectado al servidor.', 'success');

    if (data.active && data.session) {
      showApp(data.session);
    } else {
      showLogin();
    }
  } catch (error) {
    console.error('No se pudo verificar la sesión:', error);
    setConnectionStatus('No se pudo conectar con el servidor. Reintenta la conexión.', 'error');
    retryButton.hidden = false;
    showLogin();
  }
}

async function handleLogin(username, password) {
  if (isSubmitting) return;

  isSubmitting = true;
  loginSubmit.disabled = true;
  loginError.textContent = '';

  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (response.ok && data.ok && data.session) {
      showApp(data.session);
    } else {
      showError(data.error || data.message || 'Usuario o contraseña incorrectos');
    }
  } catch (error) {
    console.error('Error durante el login:', error);
    showError('No se pudo conectar con el servidor. Inténtalo de nuevo.');
    setConnectionStatus('Error de conexión con el servidor.', 'error');
    retryButton.hidden = false;
  } finally {
    isSubmitting = false;
    loginSubmit.disabled = false;
  }
}

async function handleLogout() {
  logoutButton.disabled = true;

  try {
    const response = await fetch(`${API_BASE}/logout`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Error al cerrar sesión');
    }

    showLogin();
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    showLogin();
  } finally {
    logoutButton.disabled = false;
  }
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    showError('Usuario y contraseña son obligatorios');
    return;
  }
  if (username.length > 100 || password.length > 200) {
    showError('Usuario o contraseña demasiado largos');
    return;
  }

  handleLogin(username, password);
});

logoutButton.addEventListener('click', () => {
  if (!currentSession) return;
  handleLogout();
});

retryButton.addEventListener('click', () => {
  checkSession();
});

checkSession();
