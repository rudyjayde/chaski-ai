/* ============================================================
   admin/js/ui.js — UI Utilities: Toast, Skeleton, Empty/Error
   Chaski AI v2.0
   ============================================================ */
'use strict';

/* ── TOAST MANAGER ─────────────────────────────────────────── */
const ICONS = {
  success: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  error:   `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  warning: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info:    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  close:   `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
};

class ToastManager {
  constructor() {
    this._container = null;
    this._ensure();
  }

  _ensure() {
    if (this._container && document.contains(this._container)) return;
    this._container = document.getElementById('ds-toast-container');
    if (!this._container) {
      this._container = document.createElement('div');
      this._container.id = 'ds-toast-container';
      document.body.appendChild(this._container);
    }
  }

  show({ type = 'info', title = '', message = '', duration = 4000 } = {}) {
    this._ensure();

    const el = document.createElement('div');
    el.className = `ds-toast ds-toast-${type}`;
    el.style.setProperty('--toast-dur', `${duration}ms`);
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'polite');

    el.innerHTML = `
      <div class="ds-toast-icon">${ICONS[type] || ICONS.info}</div>
      <div class="ds-toast-body">
        ${title ? `<div class="ds-toast-title">${_esc(title)}</div>` : ''}
        ${message ? `<div class="ds-toast-msg">${_esc(message)}</div>` : ''}
      </div>
      <button class="ds-toast-close" aria-label="Cerrar">${ICONS.close}</button>
      <div class="ds-toast-progress"></div>
    `;

    this._container.appendChild(el);

    // Animate in (next frame so CSS transition fires)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.classList.add('ds-toast--show'));
    });

    const dismiss = () => {
      el.classList.add('ds-toast--hide');
      el.classList.remove('ds-toast--show');
      el.addEventListener('transitionend', () => el.remove(), { once: true });
    };

    el.querySelector('.ds-toast-close').addEventListener('click', dismiss);

    const timer = setTimeout(dismiss, duration);
    el.addEventListener('mouseenter', () => clearTimeout(timer));
    el.addEventListener('mouseleave', () => setTimeout(dismiss, 1200));

    return { dismiss };
  }

  success(message, title = 'Completado') { return this.show({ type: 'success', title, message }); }
  error(message, title = 'Error')         { return this.show({ type: 'error',   title, message, duration: 6000 }); }
  warning(message, title = 'Atención')    { return this.show({ type: 'warning', title, message, duration: 5000 }); }
  info(message, title = '')               { return this.show({ type: 'info',    title, message }); }
}

function _esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

window.toast = new ToastManager();

// Backward-compatible alias: window.showToast(msg, type)
window.showToast = function (msg, type = 'info') {
  const map = { success: 'success', error: 'error', danger: 'error', warning: 'warning', info: 'info' };
  window.toast.show({ type: map[type] || 'info', message: msg });
};


/* ── SKELETON HELPERS ──────────────────────────────────────── */

/**
 * Genera un bloque de texto esqueleto con varias líneas.
 * @param {number[]} widths - porcentajes de ancho de cada línea
 * @param {string}   heightClass - clase de altura: 'h-sm'|''|'h-lg'|'h-xl'
 */
function skText(widths = [100, 75], heightClass = '') {
  return widths.map(w =>
    `<div class="skeleton sk-text ${heightClass}" style="width:${w}%"></div>`
  ).join('');
}

/** Skeleton de card KPI */
function skKpiCard() {
  return `
    <div class="kpi-skeleton-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div class="skeleton sk-text h-sm" style="width:55%"></div>
        <div class="skeleton sk-circle" style="width:32px;height:32px"></div>
      </div>
      <div class="skeleton sk-text h-2xl" style="width:50%"></div>
      <div class="skeleton sk-text h-sm" style="width:70%"></div>
    </div>`;
}

/** Skeleton de fila de tabla */
function skTableRow(cols = [30, 15, 20, 15, 12]) {
  const cells = cols.map(w =>
    `<td><div class="skeleton sk-text" style="width:${w}%"></div></td>`
  ).join('');
  return `<tr>${cells}</tr>`;
}

/** Inserta N filas skeleton en un <tbody> */
function setTableSkeleton(tbodyEl, rows = 6, cols) {
  if (!tbodyEl) return;
  tbodyEl.innerHTML = Array.from({ length: rows }, () => skTableRow(cols)).join('');
}

window.ui = {
  skText,
  skKpiCard,
  skTableRow,
  setTableSkeleton,
};


/* ── EMPTY STATE ───────────────────────────────────────────── */

/**
 * Renderiza un estado vacío dentro de un contenedor.
 * @param {Element} el
 * @param {{icon?:string, title:string, desc?:string, action?:string, onAction?:Function}} opts
 */
function renderEmptyState(el, {
  icon = 'inbox',
  title = 'Sin resultados',
  desc = '',
  action = '',
  onAction = null,
} = {}) {
  if (!el) return;
  const svg = _lucideIcon(icon);
  el.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">${svg}</div>
      <div class="empty-state-title">${_esc(title)}</div>
      ${desc ? `<p class="empty-state-desc">${_esc(desc)}</p>` : ''}
      ${action ? `<button class="btn btn-secondary btn-sm empty-action">${_esc(action)}</button>` : ''}
    </div>`;
  if (action && onAction) {
    el.querySelector('.empty-action')?.addEventListener('click', onAction);
  }
}

window.renderEmptyState = renderEmptyState;


/* ── ERROR STATE ───────────────────────────────────────────── */

/**
 * Renderiza un estado de error dentro de un contenedor.
 */
function renderErrorState(el, {
  title = 'Error al cargar',
  desc = 'Ocurrió un problema. Intenta de nuevo.',
  action = 'Reintentar',
  onAction = null,
} = {}) {
  if (!el) return;
  el.innerHTML = `
    <div class="error-state">
      <div class="error-state-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div class="error-state-title">${_esc(title)}</div>
      <p class="error-state-desc">${_esc(desc)}</p>
      ${action ? `<button class="btn btn-outline btn-sm error-retry">${_esc(action)}</button>` : ''}
    </div>`;
  if (action && onAction) {
    el.querySelector('.error-retry')?.addEventListener('click', onAction);
  }
}

window.renderErrorState = renderErrorState;


/* ── LOADING OVERLAY ───────────────────────────────────────── */

function showLoadingOverlay(el, text = '') {
  if (!el) return;
  const prev = el.style.position;
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  const ov = document.createElement('div');
  ov.className = 'loading-overlay';
  ov.innerHTML = `
    <div class="spinner spinner-md"></div>
    ${text ? `<span>${_esc(text)}</span>` : ''}`;
  ov.dataset.prevPos = prev;
  el.appendChild(ov);
  return ov;
}

function hideLoadingOverlay(overlayEl) {
  if (!overlayEl) return;
  overlayEl.remove();
}

window.showLoadingOverlay = showLoadingOverlay;
window.hideLoadingOverlay = hideLoadingOverlay;


/* ── BADGE HELPERS ─────────────────────────────────────────── */

const STATUS_MAP = {
  activo:      { cls: 'badge-success',  label: 'Activo' },
  inactivo:    { cls: 'badge-default',  label: 'Inactivo' },
  disponible:  { cls: 'badge-success',  label: 'Disponible' },
  ocupado:     { cls: 'badge-warning',  label: 'Ocupado' },
  pendiente:   { cls: 'badge-warning',  label: 'Pendiente' },
  en_ruta:     { cls: 'badge-blue',     label: 'En Ruta' },
  completado:  { cls: 'badge-success',  label: 'Completado' },
  cancelado:   { cls: 'badge-danger',   label: 'Cancelado' },
  suspendido:  { cls: 'badge-danger',   label: 'Suspendido' },
  mantenimiento:{ cls: 'badge-warning', label: 'Mantenimiento' },
  emitido:     { cls: 'badge-blue',     label: 'Emitido' },
  aprobado:    { cls: 'badge-success',  label: 'Aprobado' },
  rechazado:   { cls: 'badge-danger',   label: 'Rechazado' },
};

/**
 * Genera HTML de badge a partir de un estado.
 * @param {string} status
 * @returns {string} HTML del badge
 */
function statusBadge(status) {
  const key = String(status).toLowerCase().replace(/\s/g, '_');
  const s = STATUS_MAP[key] || { cls: 'badge-default', label: status };
  return `<span class="badge ${s.cls}">${_esc(s.label)}</span>`;
}

window.statusBadge = statusBadge;


/* ── LUCIDE ICON HELPER (inline SVG mínimo) ────────────────── */
const LUCIDE_ICONS = {
  inbox:           `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
  search:          `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  'file-search':   `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v3"/><polyline points="14 2 14 8 20 8"/><path d="M5 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="m9 18-1.5-1.5"/></svg>`,
  'truck':         `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
  'alert-circle':  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  'bar-chart-2':   `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  'list-ordered':  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>`,
};

function _lucideIcon(name) {
  return LUCIDE_ICONS[name] || LUCIDE_ICONS['inbox'];
}


/* ── INIT: llamar lucide.createIcons() cuando Lucide esté listo ── */
function _initLucide() {
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initLucide);
} else {
  _initLucide();
}
