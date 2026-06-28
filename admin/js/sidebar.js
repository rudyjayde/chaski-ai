/* ============================================================
   admin/js/sidebar.js — Sidebar dinámico del panel admin
   Chaski AI v2.0
   Inyecta el HTML del sidebar y marca el enlace activo
   automáticamente según window.location.pathname.
   ============================================================ */
'use strict';

(function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const path = window.location.pathname.replace(/\/$/, '') || '/admin/dashboard';

  function isActive(href) {
    const h = href.replace(/\/$/, '');
    if (h === '/admin/dashboard') return path === '/admin/dashboard' || path === '/admin';
    return path.startsWith(h);
  }

  function navLink(href, icon, label, attrs = '') {
    return `<a href="${href}" class="asb-link${isActive(href) ? ' active' : ''}"${attrs}>
      <i class="fas ${icon}"></i><span>${label}</span>
    </a>`;
  }

  sidebar.innerHTML = `
    <div class="asb-logo">
      <div class="asb-logo-img-wrap">
        <img src="/img/logo-oscuro.png" alt="Chaski AI">
      </div>
      <div class="asb-logo-text">
        <span class="asb-name">CHASKI <em>AI</em></span>
        <span class="asb-sub">Centro de Control</span>
      </div>
    </div>

    <div class="asb-assoc">
      <i class="fas fa-building"></i>
      <div><strong>ATIPCAR</strong><span>Panel Administrador</span></div>
    </div>

    <nav class="asb-nav">
      <span class="asb-nav-label">Principal</span>
      ${navLink('/admin/dashboard', 'fa-tachometer-alt', 'Dashboard')}
      <a href="/admin/manifests" class="asb-link${isActive('/admin/manifests') ? ' active' : ''}">
        <i class="fas fa-file-invoice"></i><span>Manifiestos</span>
        <span class="asb-badge" id="pendingManifests" style="display:none">0</span>
      </a>
      ${navLink('/admin/trips',    'fa-route',          'Viajes')}

      <span class="asb-nav-label">Flota</span>
      ${navLink('/admin/vehicles', 'fa-bus',            'Vehículos')}
      ${navLink('/admin/drivers',  'fa-id-card',        'Conductores')}
      ${navLink('/admin/queue',    'fa-list-ol',        'Lista Diaria')}

      <span class="asb-nav-label">Análisis</span>
      ${navLink('/admin/gps',     'fa-satellite-dish', 'Dispositivos GPS')}
      ${navLink('/admin/reports', 'fa-chart-bar',      'Reportes')}
      <a href="/admin/assistant"
         class="asb-link${isActive('/admin/assistant') ? ' active' : ''}"
         id="nav-assistant"
         onclick="event.preventDefault();const b=document.getElementById('aiFloatBtn');b?b.click():window.location.href='/admin/assistant'">
        <i class="fas fa-robot"></i><span>Asistente Chaski AI</span>
      </a>
    </nav>

    <div class="asb-footer">
      <a href="/" class="asb-link asb-link-out">
        <i class="fas fa-globe"></i><span>Sitio Web</span>
      </a>
      <button onclick="logout()" class="asb-link asb-link-out">
        <i class="fas fa-sign-out-alt"></i><span>Cerrar Sesión</span>
      </button>
    </div>
  `;
})();
