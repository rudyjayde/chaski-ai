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

/* ── Logout ──────────────────────────────────────────────────── */
window.logout = function () {
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

/* ── Toast notifications ─────────────────────────────────────── */
window.showToast = function (message, type = 'info') {
  const STYLES = {
    success: { bg: 'rgba(0,255,148,0.12)', border: 'rgba(0,255,148,0.3)',  color: '#00FF94' },
    error:   { bg: 'rgba(255,68,68,0.12)', border: 'rgba(255,68,68,0.3)',  color: '#FF6B6B' },
    warning: { bg: 'rgba(255,184,0,0.12)', border: 'rgba(255,184,0,0.3)', color: '#FFB800' },
    info:    { bg: 'rgba(0,200,255,0.12)', border: 'rgba(0,200,255,0.3)', color: '#00C8FF' },
  };
  const s = STYLES[type] || STYLES.info;

  if (!document.getElementById('toast-keyframes')) {
    const style = document.createElement('style');
    style.id = 'toast-keyframes';
    style.textContent = '@keyframes toast-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}';
    document.head.appendChild(style);
  }

  const toast = document.createElement('div');
  Object.assign(toast.style, {
    position: 'fixed', bottom: '24px', right: '24px', zIndex: '9999',
    background: s.bg, border: `1px solid ${s.border}`, color: s.color,
    padding: '12px 20px', borderRadius: '10px', fontSize: '0.86rem', fontWeight: '500',
    backdropFilter: 'blur(8px)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    animation: 'toast-in 0.25s ease', maxWidth: '340px',
    fontFamily: 'var(--font-body, DM Sans, sans-serif)',
  });
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
};
