/* ============================================================
   driver/core.js — Utilidades compartidas del panel conductor
   ============================================================ */
'use strict';

/* ── Auth guard ──────────────────────────────────────────────── */
const _dSession = JSON.parse(localStorage.getItem('chaski_user') || 'null');
if (!_dSession || _dSession.role !== 'driver') {
  window.location.href = '/login';
}

/* ── authFetch para el panel driver ─────────────────────────── */
window.authFetch = async function authFetch(url, options = {}) {
  const s = JSON.parse(localStorage.getItem('chaski_user') || '{}');
  const headers = {
    ...(options.headers || {}),
    ...(s.token     ? { 'Authorization': 'Bearer ' + s.token }  : {}),
    ...(s.csrfToken ? { 'X-CSRF-Token':  s.csrfToken }          : {}),
  };
  let res = await fetch(url, { ...options, headers });

  if (res.status === 401 && s.refreshToken) {
    try {
      const rr = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: s.refreshToken }),
      });
      if (rr.ok) {
        const data = await rr.json();
        const updated = { ...s, token: data.token, refreshToken: data.refreshToken, csrfToken: data.csrfToken };
        localStorage.setItem('chaski_user', JSON.stringify(updated));
        res = await fetch(url, {
          ...options,
          headers: { ...(options.headers || {}), 'Authorization': 'Bearer ' + data.token, 'X-CSRF-Token': data.csrfToken },
        });
      } else {
        localStorage.removeItem('chaski_user');
        window.location.href = '/login';
      }
    } catch {
      localStorage.removeItem('chaski_user');
      window.location.href = '/login';
    }
  }
  return res;
};

/* ── Logout ──────────────────────────────────────────────────── */
window.logout = function () {
  const s = JSON.parse(localStorage.getItem('chaski_user') || '{}');
  if (s.token && s.refreshToken) {
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.token, 'X-CSRF-Token': s.csrfToken || '' },
      body: JSON.stringify({ refreshToken: s.refreshToken }),
    }).catch(() => {});
  }
  localStorage.removeItem('chaski_user');
  window.location.href = '/login';
};

/* ── Lucide auto-init ────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof lucide === 'undefined') return;
  lucide.createIcons();
  let _t = null;
  new MutationObserver(() => {
    clearTimeout(_t);
    _t = setTimeout(() => lucide.createIcons(), 60);
  }).observe(document.body, { childList: true, subtree: true });
});
