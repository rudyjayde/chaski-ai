/* ============================================================
   login.js — Lógica de la página de inicio de sesión
   Chaski AI v2.0
   ============================================================
   Contenido:
   1.  Selector de rol
   2.  Toggle de contraseña visible/oculta
   3.  Manejo del formulario (validación + redirección)
   4.  Credenciales demo hardcodeadas (reemplazar con API en prod.)
   ============================================================ */

'use strict';

/* ============================================================
   1. SELECTOR DE ROL
   ============================================================ */
let currentRole = 'driver';

/**
 * Activa el botón de rol seleccionado y actualiza el placeholder
 * del campo de usuario para orientar al operador.
 * @param {string}      role - 'driver' | 'admin'
 * @param {HTMLElement} btn  - Botón clickeado
 */
function selectRole(role, btn) {
  currentRole = role;

  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const usernameInput = document.getElementById('username');
  if (!usernameInput) return;

  usernameInput.placeholder = role === 'admin'
    ? 'admin.tipcar'
    : 'Ej: eloy.mamani';
}

/* Exponer al scope global (usada desde onclick en HTML) */
window.selectRole = selectRole;


/* ============================================================
   5. RECUPERACIÓN DE CONTRASEÑA
   ============================================================ */
let _recoverUsername = null;

function openRecoverModal() {
  _recoverUsername = null;
  document.getElementById('recoverStep1').style.display = '';
  document.getElementById('recoverStep2').style.display = 'none';
  document.getElementById('recoverStep3').style.display = 'none';
  document.getElementById('recUser').value  = '';
  document.getElementById('recDni').value   = '';
  document.getElementById('recoverError').classList.remove('show');
  document.getElementById('recoverOverlay').classList.add('open');
  setTimeout(() => document.getElementById('recUser').focus(), 80);
}

function closeRecoverModal(e) {
  if (e && e.target !== document.getElementById('recoverOverlay')) return;
  document.getElementById('recoverOverlay').classList.remove('open');
}

function verifyRecoverIdentity() {
  const username = (document.getElementById('recUser').value || '').trim().toLowerCase();
  const dni      = (document.getElementById('recDni').value  || '').trim();
  const errBox   = document.getElementById('recoverError');
  const errText  = document.getElementById('recoverErrorText');

  errBox.classList.remove('show');

  if (!username || !dni) {
    errText.textContent = 'Completa todos los campos.';
    errBox.classList.add('show');
    return;
  }

  const user = window.DEMO_USERS && window.DEMO_USERS[username];

  if (!user || user.role !== 'driver') {
    errText.textContent = 'Usuario no encontrado.';
    errBox.classList.add('show');
    return;
  }

  /* Verificar contra localStorage primero (si ya se cambió antes), luego vs. dato base */
  const storedDni = localStorage.getItem('chaski_dni_' + username) || user.dni;

  if (storedDni !== dni) {
    errText.textContent = 'DNI incorrecto. Verifica el número.';
    errBox.classList.add('show');
    return;
  }

  _recoverUsername = username;
  document.getElementById('recoverStep1').style.display = 'none';
  document.getElementById('recoverStep2').style.display = '';
  document.getElementById('recPass1').value  = '';
  document.getElementById('recPass2').value  = '';
  document.getElementById('recoverError2').classList.remove('show');
  setTimeout(() => document.getElementById('recPass1').focus(), 80);
}

function toggleRecoverPass() {
  const inp = document.getElementById('recPass1');
  const ico = document.getElementById('toggleRecPass');
  const hidden = inp.type === 'password';
  inp.type = hidden ? 'text' : 'password';
  ico.className = hidden ? 'fas fa-eye-slash input-eye' : 'fas fa-eye input-eye';
}

function submitRecovery() {
  const pass1  = document.getElementById('recPass1').value;
  const pass2  = document.getElementById('recPass2').value;
  const errBox = document.getElementById('recoverError2');
  const errTxt = document.getElementById('recoverErrorText2');

  errBox.classList.remove('show');

  if (!pass1 || pass1.length < 6) {
    errTxt.textContent = 'La contraseña debe tener al menos 6 caracteres.';
    errBox.classList.add('show');
    return;
  }

  if (pass1 !== pass2) {
    errTxt.textContent = 'Las contraseñas no coinciden.';
    errBox.classList.add('show');
    return;
  }

  /* Actualizar en memoria + localStorage para persistir entre recargas */
  if (window.DEMO_USERS && _recoverUsername) {
    window.DEMO_USERS[_recoverUsername].password = pass1;
    localStorage.setItem('chaski_pass_' + _recoverUsername, pass1);
  }

  document.getElementById('recoverStep2').style.display = 'none';
  document.getElementById('recoverStep3').style.display = '';
}

window.openRecoverModal   = openRecoverModal;
window.closeRecoverModal  = closeRecoverModal;
window.verifyRecoverIdentity = verifyRecoverIdentity;
window.toggleRecoverPass  = toggleRecoverPass;
window.submitRecovery     = submitRecovery;


/* ============================================================
   2. TOGGLE CONTRASEÑA
   ============================================================ */
(function initPasswordToggle() {
  const eyeBtn      = document.getElementById('togglePass');
  const passwordInput = document.getElementById('password');

  if (!eyeBtn || !passwordInput) return;

  eyeBtn.addEventListener('click', () => {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    eyeBtn.className   = isHidden ? 'fas fa-eye-slash input-eye' : 'fas fa-eye input-eye';
  });
})();


/* ============================================================
   3. FORMULARIO DE LOGIN
   ============================================================ */
(function initLoginForm() {

  const form       = document.getElementById('loginForm');
  const errorBox   = document.getElementById('loginError');
  const errorText  = document.getElementById('loginErrorText');
  const submitBtn  = document.querySelector('.btn-submit-login');

  if (!form) return;

  /* ---- Credenciales demo ----
     En producción reemplazar con llamada a:
     POST /api/auth/login  →  { token, role, name }
  ---------------------------------------------------------------- */
  const DEMO_USERS = {
    'admin.tipcar':    { password: 'admin123', role: 'admin',  name: 'Administrador TipCar', redirect: '/admin/dashboard',  dni: null },
    'eloy.mamani':     { password: 'admin123', role: 'driver', name: 'Eloy Mamani',           redirect: 'driver/index.html', dni: '40123456' },
    'jose.quispe':     { password: 'admin123', role: 'driver', name: 'José Quispe',            redirect: 'driver/index.html', dni: '40234567' },
    'abraham.morales': { password: 'admin123', role: 'driver', name: 'Abraham Morales',        redirect: 'driver/index.html', dni: '40345678' },
    'juan.perez':      { password: 'admin123', role: 'driver', name: 'Juan Pérez',             redirect: 'driver/index.html', dni: '40456789' },
    'carlos.ticona':   { password: 'admin123', role: 'driver', name: 'Carlos Ticona',          redirect: 'driver/index.html', dni: '40567890' },
  };

  /* Exponer DEMO_USERS para que el módulo de recuperación pueda mutarlo */
  window.DEMO_USERS = DEMO_USERS;

  /* ---- Mostrar error ---- */
  function showError(msg) {
    if (errorText) errorText.textContent = msg;
    if (errorBox)  errorBox.classList.add('show');
  }

  /* ---- Ocultar error al escribir ---- */
  form.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', () => {
      if (errorBox) errorBox.classList.remove('show');
    });
  });

  /* ---- Submit — llama a la API real ---- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = (document.getElementById('username')?.value || '').trim().toLowerCase();
    const password = document.getElementById('password')?.value || '';

    if (!username || !password) {
      showError('Completa todos los campos.');
      return;
    }

    if (submitBtn) {
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ingresando...';
      submitBtn.disabled  = true;
    }

    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        showError(data.error || 'Credenciales incorrectas.');
        if (submitBtn) { submitBtn.innerHTML = 'INGRESAR'; submitBtn.disabled = false; }
        return;
      }

      /* Validar rol seleccionado vs. rol real */
      if (data.user.role !== currentRole && !(currentRole === 'admin' && data.user.role === 'supervisor')) {
        const label = data.user.role === 'admin' ? 'Administrador' : 'Conductor';
        showError(`Esta cuenta es de tipo "${label}". Selecciona el rol correcto.`);
        if (submitBtn) { submitBtn.innerHTML = 'INGRESAR'; submitBtn.disabled = false; }
        return;
      }

      /* Guardar sesión */
      localStorage.setItem('chaski_user', JSON.stringify({
        ...data.user,
        token:     data.token,
        loginTime: new Date().toISOString(),
      }));

      const redirect = data.user.role === 'admin' ? '/admin/dashboard' : 'driver/index.html';
      setTimeout(() => { window.location.href = redirect; }, 500);

    } catch (err) {
      showError('No se pudo conectar con el servidor. Verifica que el backend esté corriendo.');
      if (submitBtn) { submitBtn.innerHTML = 'INGRESAR'; submitBtn.disabled = false; }
    }
  });

})();
