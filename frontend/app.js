'use strict';

const WS_URL = 'ws://localhost:3000';
const RESPONSE_TIMEOUT_MS = 10000;

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

let socket = null;
let currentSession = null;
let pendingType = null;
let responseTimer = null;

function setConnectionStatus(message, state = '') {
  connectionStatus.textContent = message;
  connectionStatus.dataset.state = state;
  appConnectionStatus.textContent = message;
  appConnectionStatus.dataset.state = state;
}

function clearPendingRequest() {
  pendingType = null;
  window.clearTimeout(responseTimer);
  loginSubmit.disabled = false;
  logoutButton.disabled = false;
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
    localStorage.removeItem('token');
    showLogin();
    showError('El servidor devolvió una sesión inválida');
    return;
  }
  currentSession = session;
  currentSession = session;
  loginView.classList.remove('active');
  appView.classList.add('active');
  userDisplay.textContent = session.username;
  welcomeName.textContent = session.username;
  expiresDisplay.textContent = session.expiresAt
    ? new Date(session.expiresAt).toLocaleString()
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

function sendMessage(type, payload = {}) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    setConnectionStatus('No hay conexión con el servidor. Reintenta la conexión.', 'error');
    retryButton.hidden = false;
    return false;
  }

  if (pendingType) {
    return false;
  }

  pendingType = type;
  if (type === 'auth:login') loginSubmit.disabled = true;
  if (type === 'auth:logout') logoutButton.disabled = true;

  responseTimer = window.setTimeout(() => {
    const timedOutType = pendingType;
    clearPendingRequest();
    if (timedOutType === 'auth:logout') {
      localStorage.removeItem('token');
      showLogin();
    }
    showError('El servidor no respondió a tiempo. Inténtalo de nuevo.');
  }, RESPONSE_TIMEOUT_MS);

  try {
    socket.send(JSON.stringify({ type, payload }));
    return true;
  } catch (error) {
    clearPendingRequest();
    console.error('No se pudo enviar el mensaje al servidor:', error);
    setConnectionStatus('No se pudo enviar la solicitud al servidor.', 'error');
    retryButton.hidden = false;
    return false;
  }
}

function handleMessage(message) {
  if (!message || typeof message.type !== 'string') {
    console.error('El servidor envió un mensaje con formato inválido');
    return;
  }

  if (message.type !== pendingType) {
    console.warn('Respuesta inesperada del servidor:', message.type);
    return;
  }

  clearPendingRequest();

  switch (message.type) {
    case 'session:check':
      if (message.ok && message.data) {
        showApp(message.data);
      } else {
        localStorage.removeItem('token');
        showLogin();
      }
      break;
    case 'auth:login':
      if (message.ok && message.data && typeof message.data.token === 'string') {
        localStorage.setItem('token', message.data.token);
        showApp(message.data);
      } else {
        showError(message.error || 'Usuario o contraseña incorrectos');
      }
      break;
    case 'auth:logout':
      if (message.ok) {
        localStorage.removeItem('token');
        showLogin();
      } else {
        showError(message.error || 'No se pudo cerrar la sesión.');
      }
      break;
    default:
      break;
  }
}

function connectWebSocket() {
  retryButton.hidden = true;
  setConnectionStatus('Conectando con el servidor…');

  try {
    socket = new WebSocket(WS_URL);
  } catch (error) {
    console.error('No se pudo iniciar la conexión WebSocket:', error);
    setConnectionStatus('No se pudo iniciar la conexión con el servidor.', 'error');
    retryButton.hidden = false;
    return;
  }

  socket.addEventListener('open', () => {
    setConnectionStatus('Conectado al servidor.', 'success');
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      sendMessage('session:check', { token: savedToken });
    } else {
      showLogin();
    }
  });

  socket.addEventListener('message', (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (error) {
      console.error('El servidor envió JSON inválido:', error);
      showError('El servidor envió una respuesta inválida.');
      return;
    }
    handleMessage(message);
  });

  socket.addEventListener('error', (error) => {
    console.error('Error de WebSocket:', error);
    setConnectionStatus('Error de conexión con el servidor.', 'error');
  });

  socket.addEventListener('close', () => {
    const closedDuringLogout = pendingType === 'auth:logout';
    clearPendingRequest();
    setConnectionStatus('Desconectado del servidor.', 'error');
    retryButton.hidden = false;
    if (closedDuringLogout) {
      localStorage.removeItem('token');
      showLogin();
    }
  });
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

  loginError.textContent = '';
  sendMessage('auth:login', { username, password });
});

logoutButton.addEventListener('click', () => {
  if (!currentSession) return;
  sendMessage('auth:logout');
});

retryButton.addEventListener('click', () => {
  if (socket && socket.readyState !== WebSocket.CLOSED) {
    socket.addEventListener('close', connectWebSocket, { once: true });
    socket.close();
    return;
  }
  connectWebSocket();
});

connectWebSocket();
