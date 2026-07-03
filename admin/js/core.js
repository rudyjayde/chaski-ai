/* ============================================================
   admin/js/core.js — Funciones compartidas del panel admin
   Chaski AI v2.0
   Incluir en TODOS los módulos del panel administrador.
   ============================================================ */
'use strict';

/* ── Auth Guard ──────────────────────────────────────────────── */
(function checkAuth() {
  const session = JSON.parse(localStorage.getItem('chaski_user') || 'null');
  if (!session || session.role !== 'admin') {
    window.location.href = '/login';
    return;
  }
  const nameEl = document.getElementById('adminUserName');
  if (nameEl) nameEl.textContent = session.name || session.username || 'Admin';
})();

/* ── authFetch global — con CSRF y auto-refresh ──────────────── */
window.authFetch = async function authFetch(url, options = {}) {
  const session = JSON.parse(localStorage.getItem('chaski_user') || '{}');

  const headers = {
    ...(options.headers || {}),
    ...(session.token      ? { 'Authorization': 'Bearer ' + session.token }      : {}),
    ...(session.csrfToken  ? { 'X-CSRF-Token':  session.csrfToken }               : {}),
  };

  let res = await fetch(url, { ...options, headers });

  // Intento de renovación de token cuando expira
  if (res.status === 401 && session.refreshToken) {
    try {
      const refreshRes = await fetch('/api/auth/refresh', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refreshToken: session.refreshToken }),
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json();
        const updated = {
          ...session,
          token:        data.token,
          refreshToken: data.refreshToken,
          csrfToken:    data.csrfToken,
        };
        localStorage.setItem('chaski_user', JSON.stringify(updated));

        // Reintentar la petición original con el nuevo token
        res = await fetch(url, {
          ...options,
          headers: {
            ...(options.headers || {}),
            'Authorization': 'Bearer ' + data.token,
            'X-CSRF-Token':  data.csrfToken,
          },
        });
      } else {
        window.logout();
        return res;
      }
    } catch {
      window.logout();
      return res;
    }
  }

  return res;
};

/* ── Logout ──────────────────────────────────────────────────── */
window.logout = async function () {
  const session = JSON.parse(localStorage.getItem('chaski_user') || '{}');

  // Notificar al backend para revocar el refresh token
  if (session.token && session.refreshToken) {
    try {
      await fetch('/api/auth/logout', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'Bearer ' + session.token,
          'X-CSRF-Token':  session.csrfToken || '',
        },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
    } catch {
      // No bloquear el logout local si el servidor no responde
    }
  }

  localStorage.removeItem('chaski_user');
  window.location.href = '/login';
};

/* ── Reloj en tiempo real ────────────────────────────────────── */
(function initClock() {
  function tick() {
    const now  = new Date();
    const time = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    const date = now.toLocaleDateString('es-PE', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
    const clockEl = document.getElementById('adminClock');
    const dateEl  = document.getElementById('adminDate');
    if (clockEl) clockEl.textContent = time;
    if (dateEl)  dateEl.textContent  = date.charAt(0).toUpperCase() + date.slice(1);
  }
  tick();
  setInterval(tick, 1000);
})();

/* ── Sidebar toggle (móvil) ──────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const btn     = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  if (btn && sidebar) {
    btn.addEventListener('click', () => sidebar.classList.toggle('open'));
  }
});

/* ── Toast / UI — delegado a ui.js ──────────────────────────── */
// window.showToast y window.toast los provee admin/js/ui.js

/* ── Lucide icons — inicializar tras inyección de sidebar ────── */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof lucide !== 'undefined') lucide.createIcons();
});
