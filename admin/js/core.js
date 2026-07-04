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

/* ── Lucide icons — auto-reiniciar en cambios dinámicos del DOM ── */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof lucide === 'undefined') return;
  lucide.createIcons();
  // Debounced observer: re-renderiza iconos cada vez que el JS inyecta HTML
  let _t = null;
  new MutationObserver(() => {
    clearTimeout(_t);
    _t = setTimeout(() => lucide.createIcons(), 60);
  }).observe(document.body, { childList: true, subtree: true });
});

/* ── Banner emergente — Alertas SOS / Incidentes de conductores ── */
(function initAlertBanner() {
  // IDs ya vistos en esta sesión → no volver a sonar
  const _seen = new Set(JSON.parse(sessionStorage.getItem('_chskAlertsSeen') || '[]'));
  let _bannerEl = null;

  function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function _time(iso) {
    try { return new Date(iso).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}); } catch { return ''; }
  }

  function _sound(urgent) {
    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)();
      const beep = (freq, t) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'square'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        o.start(t); o.stop(t + 0.18);
      };
      const now = ctx.currentTime;
      if (urgent) { beep(880, now); beep(660, now+0.22); beep(880, now+0.44); }
      else        { beep(660, now); beep(660, now+0.28); }
    } catch {}
  }

  function _getBanner() {
    if (_bannerEl) return _bannerEl;
    _bannerEl = document.createElement('div');
    _bannerEl.id = 'driverAlertBanner';
    Object.assign(_bannerEl.style, {
      position:'fixed', top:'0', left:'0', right:'0', zIndex:'10000',
      display:'none', alignItems:'center', gap:'14px',
      padding:'11px 20px', fontFamily:'inherit', fontSize:'13px',
      boxShadow:'0 4px 32px rgba(0,0,0,.6)',
      transform:'translateY(-100%)',
      transition:'transform .32s cubic-bezier(.4,0,.2,1)',
    });
    document.body.prepend(_bannerEl);
    return _bannerEl;
  }

  function _show(alert, total) {
    const el       = _getBanner();
    const urgent   = alert.type === 'urgent';
    const color    = urgent ? '#FF4444' : '#F59E0B';
    const bg       = urgent ? 'rgba(160,0,0,.97)' : 'rgba(130,60,0,.97)';
    const icon     = urgent ? '🚨' : '⚠️';
    const snippet  = alert.body ? ' · ' + _esc(alert.body.slice(0,55)) + (alert.body.length>55?'…':'') : '';
    const extra    = total > 1 ? `<span style="background:rgba(255,255,255,.18);border-radius:10px;padding:1px 8px;font-size:11px;margin-left:8px">+${total-1} más</span>` : '';
    const isIndex  = /\/(admin\/?|admin\/index\.html)$/.test(window.location.pathname);
    const viewBtn  = !isIndex
      ? `<a href="/admin" style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.25);color:#fff;padding:6px 12px;border-radius:8px;font-size:12px;white-space:nowrap;text-decoration:none">Ver panel</a>`
      : '';

    el.style.background  = bg;
    el.style.borderBottom = `2px solid ${color}`;
    el.innerHTML = `
      <span style="font-size:22px;flex-shrink:0">${icon}</span>
      <div style="flex:1;min-width:0;overflow:hidden">
        <strong style="color:#fff">${_esc(alert.title)}</strong>${extra}
        <div style="color:rgba(255,255,255,.72);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${_esc(alert.driver_name || alert.username || '—')} · ${_time(alert.created_at)}${snippet}
        </div>
      </div>
      ${viewBtn}
      <button data-alert-id="${alert.id}"
        style="background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.35);color:#fff;
               padding:7px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;
               white-space:nowrap;flex-shrink:0">
        ✓ Resolver
      </button>`;

    el.querySelector('button[data-alert-id]').addEventListener('click', async function() {
      this.disabled = true; this.textContent = '…';
      await window._resolveAlertBanner(alert.id);
    });

    el.style.display = 'flex';
    requestAnimationFrame(() => { el.style.transform = 'translateY(0)'; });
  }

  function _hide() {
    if (!_bannerEl) return;
    _bannerEl.style.transform = 'translateY(-100%)';
    setTimeout(() => { if (_bannerEl) _bannerEl.style.display = 'none'; }, 340);
  }

  async function _check() {
    try {
      const res = await authFetch('/api/communications/driver-alerts');
      if (!res.ok) return;
      const data = await res.json();
      const pending = (data.alerts || []).filter(a => a.status === 'pending');

      if (!pending.length) { _hide(); return; }

      const top   = pending[0];
      const isNew = !_seen.has(top.id);
      _show(top, pending.length);

      if (isNew) {
        _seen.add(top.id);
        sessionStorage.setItem('_chskAlertsSeen', JSON.stringify([..._seen]));
        _sound(top.type === 'urgent');
      }
    } catch {}
  }

  window._resolveAlertBanner = async function (id) {
    try {
      await authFetch(`/api/communications/driver-alerts/${id}/resolve`, { method: 'PUT' });
      _seen.add(id);
      sessionStorage.setItem('_chskAlertsSeen', JSON.stringify([..._seen]));
    } catch {}
    await _check();
  };

  document.addEventListener('DOMContentLoaded', () => {
    _check();
    setInterval(_check, 20000);
  });
})();
