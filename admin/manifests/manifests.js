/* ============================================================
   manifests.js — Lógica de la página de Manifiestos
   Chaski AI v2.0 — Datos reales desde API REST
   ============================================================ */

'use strict';

/* ============================================================
   1. HELPER DE AUTENTICACIÓN
   ============================================================ */
function authFetch(path, opts = {}) {
  const s = JSON.parse(localStorage.getItem('chaski_user') || '{}');
  return fetch(path, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      ...(s.token ? { 'Authorization': 'Bearer ' + s.token } : {}),
    },
  });
}


/* ============================================================
   2. CARGA DESDE API
   ============================================================ */
let ALL_MANIFESTS = [];

function normalizeManifest(m) {
  const dt     = m.departure_time ? new Date(m.departure_time) : new Date(m.created_at);
  const status = m.status === 'open' ? 'transit' : m.status === 'closed' ? 'completed' : 'pending';
  return {
    id:         m.id,
    num:        m.manifest_number,
    date:       dt.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time:       dt.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    dateObj:    dt,
    company:    m.company_name || m.association_code || '—',
    unit:       m.association_code || '—',
    plate:      m.plate || '—',
    driver:     m.driver_name || '—',
    route:      m.route_name || '—',
    passengers: parseInt(m.total_passengers)  || 0,
    revenue:    parseFloat(m.total_revenue)   || 0,
    status,
  };
}

async function loadManifests() {
  try {
    const res = await authFetch('/api/manifests?limit=500');
    const data = await res.json();
    ALL_MANIFESTS = Array.isArray(data) ? data.map(normalizeManifest) : [];
  } catch (err) {
    console.error('[Manifests] Error al cargar:', err.message);
    ALL_MANIFESTS = [];
  }

  populateCompanyFilter();
  filteredData = [...ALL_MANIFESTS];
  currentPage  = 1;
  updateKPIs();
  renderTable();
}


/* ============================================================
   3. FILTROS Y BÚSQUEDA
   ============================================================ */
let filteredData = [];
let currentPage  = 1;
let sortKey      = 'date';
let sortDir      = 'desc';

function populateCompanyFilter() {
  const sel = document.getElementById('filterCompany');
  if (!sel) return;
  const current   = sel.value;
  const companies = [...new Set(ALL_MANIFESTS.map(m => m.company).filter(c => c && c !== '—'))].sort();
  sel.innerHTML   = '<option value="">Todas las empresas</option>' +
    companies.map(c => `<option value="${c}" ${c === current ? 'selected' : ''}>${c}</option>`).join('');
}

function applyFilters() {
  const text      = (document.getElementById('searchInput')?.value   || '').toLowerCase().trim();
  const company   = document.getElementById('filterCompany')?.value  || '';
  const status    = document.getElementById('filterStatus')?.value   || '';
  const fromInput = document.getElementById('filterFrom')?.value     || '';
  const toInput   = document.getElementById('filterTo')?.value       || '';

  const fromDate = fromInput ? new Date(fromInput)              : null;
  const toDate   = toInput   ? new Date(toInput + 'T23:59:59') : null;

  filteredData = ALL_MANIFESTS.filter(m => {
    if (text    && !`${m.num} ${m.plate} ${m.unit} ${m.driver}`.toLowerCase().includes(text)) return false;
    if (company && m.company !== company) return false;
    if (status  && m.status  !== status)  return false;
    if (fromDate && m.dateObj < fromDate) return false;
    if (toDate   && m.dateObj > toDate)   return false;
    return true;
  });

  currentPage = 1;
  updateKPIs();
  renderTable();
}

function clearFilters() {
  document.getElementById('searchInput').value   = '';
  document.getElementById('filterCompany').value = '';
  document.getElementById('filterStatus').value  = '';
  document.getElementById('filterFrom').value    = new Date().toISOString().slice(0, 10);
  document.getElementById('filterTo').value      = '';
  filteredData = [...ALL_MANIFESTS];
  currentPage  = 1;
  updateKPIs();
  renderTable();
}

window.applyFilters = applyFilters;
window.clearFilters = clearFilters;

document.getElementById('searchInput')?.addEventListener('input', applyFilters);


/* ============================================================
   4. RENDERIZADO DE TABLA CON PAGINACIÓN
   ============================================================ */
const STATUS_LABEL = { completed: 'Completado', pending: 'Pendiente', transit: 'En tránsito' };
const STATUS_ICON  = { completed: 'fa-check-circle', pending: 'fa-clock', transit: 'fa-truck-moving' };

function renderTable() {
  const tbody   = document.getElementById('manifestBody');
  const perPage = parseInt(document.getElementById('rowsPerPage')?.value || '10');
  const total   = filteredData.length;
  const pages   = Math.max(1, Math.ceil(total / perPage));

  if (currentPage > pages) currentPage = pages;

  const start = (currentPage - 1) * perPage;
  const slice = filteredData.slice(start, start + perPage);

  const countEl = document.getElementById('resultsCount');
  if (countEl) countEl.innerHTML = `Mostrando <strong>${total}</strong> manifiestos`;

  if (!tbody) return;

  if (slice.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align:center;padding:40px;color:var(--text-muted)">
          <i class="fas fa-file-alt" style="font-size:28px;display:block;margin-bottom:10px;opacity:0.3"></i>
          No se encontraron manifiestos con los filtros aplicados
        </td>
      </tr>`;
    renderPagination(pages);
    return;
  }

  tbody.innerHTML = slice.map(m => `
    <tr>
      <td><span class="manifest-num">${m.num}</span></td>
      <td>
        <div>${m.date}</div>
        <small style="color:var(--text-muted)">${m.time} hrs</small>
      </td>
      <td><span class="company-tag" title="${m.company}">${m.company}</span></td>
      <td>
        <span class="vehicle-code">${m.unit}</span>
        <small style="color:var(--text-muted);display:block">${m.plate}</small>
      </td>
      <td>${m.driver}</td>
      <td style="color:var(--text-sub)">${m.route}</td>
      <td style="text-align:center;font-weight:600">${m.passengers}</td>
      <td style="color:var(--gold);font-weight:600">S/ ${m.revenue.toFixed(2)}</td>
      <td>
        <span class="status-badge ${m.status}">
          <i class="fas ${STATUS_ICON[m.status]}"></i>
          ${STATUS_LABEL[m.status]}
        </span>
      </td>
      <td>
        <div class="tbl-actions">
          <button class="tbl-btn" title="Ver detalle" onclick="openModal(${m.id})">
            <i class="fas fa-eye"></i>
          </button>
          <button class="tbl-btn success" title="Descargar PDF" onclick="downloadPDF(${m.id})">
            <i class="fas fa-file-pdf"></i>
          </button>
          <button class="tbl-btn success" title="WhatsApp" onclick="whatsapp(${m.id})">
            <i class="fab fa-whatsapp"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  renderPagination(pages);
}

window.renderTable = renderTable;

function renderPagination(pages) {
  const cont = document.getElementById('pagination');
  if (!cont) return;

  let html = `<button class="pg-btn" onclick="goPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i>
              </button>`;

  const visible = new Set([1, pages]);
  for (let p = Math.max(2, currentPage - 1); p <= Math.min(pages - 1, currentPage + 1); p++) visible.add(p);
  const sorted = [...visible].sort((a, b) => a - b);

  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) html += `<span class="pg-info">…</span>`;
    html += `<button class="pg-btn ${p === currentPage ? 'active' : ''}" onclick="goPage(${p})">${p}</button>`;
    prev = p;
  }

  html += `<button class="pg-btn" onclick="goPage(${currentPage + 1})" ${currentPage >= pages ? 'disabled' : ''}>
             <i class="fas fa-chevron-right"></i>
           </button>
           <span class="pg-info">Pág. ${currentPage} / ${pages}</span>`;

  cont.innerHTML = html;
}

function goPage(p) {
  const perPage = parseInt(document.getElementById('rowsPerPage')?.value || '10');
  const pages   = Math.max(1, Math.ceil(filteredData.length / perPage));
  if (p < 1 || p > pages) return;
  currentPage = p;
  renderTable();
}
window.goPage = goPage;


/* ============================================================
   5. ORDENAMIENTO DE COLUMNAS
   ============================================================ */
function sortBy(key) {
  if (sortKey === key) {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey = key;
    sortDir = 'desc';
  }

  filteredData.sort((a, b) => {
    let va, vb;
    switch (key) {
      case 'num':        va = a.id;         vb = b.id;         break;
      case 'date':       va = a.dateObj;    vb = b.dateObj;    break;
      case 'driver':     va = a.driver;     vb = b.driver;     break;
      case 'passengers': va = a.passengers; vb = b.passengers; break;
      case 'revenue':    va = a.revenue;    vb = b.revenue;    break;
      default:           va = a.id;         vb = b.id;
    }
    if (va < vb) return sortDir === 'asc' ? -1 :  1;
    if (va > vb) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });

  document.querySelectorAll('th.sortable').forEach(th => th.classList.remove('asc', 'desc'));
  const activeHeader = document.querySelector(`th[onclick="sortBy('${key}')"]`);
  if (activeHeader) activeHeader.classList.add(sortDir);

  currentPage = 1;
  renderTable();
}
window.sortBy = sortBy;


/* ============================================================
   6. KPI MINI-ROW
   ============================================================ */
function updateKPIs() {
  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);
  const todays   = ALL_MANIFESTS.filter(m => m.dateObj >= today && m.dateObj < tomorrow);

  const total      = todays.length;
  const completed  = todays.filter(m => m.status === 'completed').length;
  const pending    = todays.filter(m => m.status === 'pending' || m.status === 'transit').length;
  const passengers = todays.reduce((s, m) => s + m.passengers, 0);
  const revenue    = todays.reduce((s, m) => s + m.revenue, 0);

  animateKPI('kpiTotal',     total);
  animateKPI('kpiCompleted', completed);
  animateKPI('kpiPending',   pending);
  animateKPI('kpiPassTotal', passengers);

  const revEl = document.getElementById('kpiRevTotal');
  if (revEl) revEl.textContent = `S/ ${revenue.toFixed(2)}`;
}

function animateKPI(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const duration = 900;
  const startTs  = performance.now();
  function step(ts) {
    const t    = Math.min((ts - startTs) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(target * ease);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}


/* ============================================================
   7. MODAL DE DETALLE — pasajeros reales desde API
   ============================================================ */
let currentModalManifest = null;
let _currentPassengers   = [];

function normalizePassenger(p, i) {
  const PAYMENT_LABEL = { cash: 'Efectivo', yape: 'Yape', plin: 'Plin' };
  return {
    num:     p.passenger_order || (i + 1),
    dni:     p.dni || '—',
    name:    p.full_name || '—',
    origin:  p.origin || '—',
    dest:    p.destination || '—',
    seat:    p.seat_number || '—',
    payment: PAYMENT_LABEL[p.payment_type] || p.payment_type || 'Efectivo',
    fare:    parseFloat(p.fare) || 7.0,
  };
}

async function openModal(manifestId) {
  const manifest = ALL_MANIFESTS.find(m => m.id === manifestId);
  if (!manifest) return;
  currentModalManifest = manifest;

  document.getElementById('modalManifestNum').textContent  = manifest.num;
  document.getElementById('modalManifestMeta').textContent =
    `${manifest.date} — ${manifest.time} hrs · ${manifest.company}`;

  const infoEl = document.getElementById('modalTripInfo');
  if (infoEl) {
    infoEl.innerHTML = [
      { label: 'Empresa',     value: manifest.company },
      { label: 'Vehículo',    value: manifest.unit },
      { label: 'Placa',       value: manifest.plate },
      { label: 'Conductor',   value: manifest.driver },
      { label: 'Ruta',        value: manifest.route },
      { label: 'Fecha',       value: manifest.date },
      { label: 'Hora salida', value: manifest.time + ' hrs' },
      { label: 'Estado',      value: `<span class="status-badge ${manifest.status}">${STATUS_LABEL[manifest.status]}</span>` },
    ].map(item => `
      <div class="mi-item">
        <span class="mi-label">${item.label}</span>
        <span class="mi-value">${item.value}</span>
      </div>
    `).join('');
  }

  _currentPassengers = [];
  const tbody = document.getElementById('modalPassBody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-muted)">
      <i class="fas fa-spinner fa-spin"></i> Cargando pasajeros...</td></tr>`;
  }

  try {
    const res  = await authFetch(`/api/manifests/${manifest.id}`);
    const data = await res.json();
    _currentPassengers = (data.passengers || []).map(normalizePassenger);
  } catch {
    _currentPassengers = [];
  }

  if (tbody) {
    if (_currentPassengers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-muted)">
        Sin pasajeros registrados en este manifiesto</td></tr>`;
    } else {
      tbody.innerHTML = _currentPassengers.map(p => `
        <tr>
          <td style="color:var(--text-muted)">${p.num}</td>
          <td style="font-family:'Rajdhani',sans-serif;font-weight:600">${p.dni}</td>
          <td>${p.name}</td>
          <td style="color:var(--text-sub)">${p.origin}</td>
          <td style="color:var(--text-sub)">${p.dest}</td>
          <td style="text-align:center">${p.seat}</td>
          <td>${p.payment}</td>
          <td style="color:var(--gold);font-weight:600">S/ ${p.fare.toFixed(2)}</td>
        </tr>
      `).join('');
    }
  }

  const byPayment = _currentPassengers.reduce((acc, p) => {
    acc[p.payment] = (acc[p.payment] || 0) + p.fare;
    return acc;
  }, {});

  const summaryEl = document.getElementById('modalSummary');
  if (summaryEl) {
    const items = Object.entries(byPayment).map(([method, total]) => `
      <div class="ms-item">
        <span class="ms-val">S/ ${total.toFixed(2)}</span>
        <span class="ms-lbl">${method}</span>
      </div>
    `).join('');

    summaryEl.innerHTML = `
      <div class="ms-item">
        <span class="ms-val">${manifest.passengers}</span>
        <span class="ms-lbl">Pasajeros</span>
      </div>
      ${items}
      <div class="ms-item">
        <span class="ms-val gold">S/ ${manifest.revenue.toFixed(2)}</span>
        <span class="ms-lbl">Total recaudado</span>
      </div>
    `;
  }

  document.getElementById('manifestModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('manifestModal').classList.remove('open');
  document.body.style.overflow = '';
  currentModalManifest = null;
  _currentPassengers   = [];
}

document.getElementById('manifestModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

window.openModal  = openModal;
window.closeModal = closeModal;


/* ============================================================
   8. EXPORTAR CSV / PDF
   ============================================================ */
function exportCSV() {
  const headers = ['N° Manifiesto', 'Fecha', 'Hora', 'Empresa', 'Vehículo', 'Placa',
                   'Conductor', 'Ruta', 'Pasajeros', 'Recaudación', 'Estado'];
  const rows = filteredData.map(m => [
    m.num, m.date, m.time, m.company, m.unit, m.plate,
    m.driver, m.route, m.passengers, `S/ ${m.revenue.toFixed(2)}`, STATUS_LABEL[m.status]
  ]);

  const csv  = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `manifiestos_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function printManifestWindow(m, passengers) {
  const rows = passengers.map(p => `
    <tr>
      <td>${p.num}</td><td>${p.dni}</td><td>${p.name}</td>
      <td>${p.origin}</td><td>${p.dest}</td><td>${p.seat}</td>
      <td>${p.payment}</td><td>S/ ${p.fare.toFixed(2)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Manifiesto ${m.num}</title>
<style>
body{font-family:Arial,sans-serif;font-size:12px;color:#000;margin:20px}
h1{font-size:16px;text-align:center;margin-bottom:4px}
.sub{text-align:center;font-size:11px;color:#555;margin-bottom:16px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;margin-bottom:16px;border:1px solid #ccc;padding:10px;border-radius:4px}
.info-row{display:flex;gap:6px}.info-label{font-weight:bold;min-width:90px}
table{width:100%;border-collapse:collapse;margin-top:8px}
th{background:#1a3a5c;color:#fff;padding:6px 8px;text-align:left;font-size:11px}
td{border:1px solid #ddd;padding:5px 8px}tr:nth-child(even) td{background:#f5f5f5}
.total{margin-top:10px;text-align:right;font-weight:bold}
@media print{body{margin:0}}
</style></head><body>
<h1>CHASKI AI — Manifiesto de Pasajeros</h1>
<div class="sub">Asociación ATIPCAR &nbsp;|&nbsp; Ruta Juli → Puno</div>
<div class="info-grid">
  <div class="info-row"><span class="info-label">N° Manifiesto:</span><span>${m.num}</span></div>
  <div class="info-row"><span class="info-label">Empresa:</span><span>${m.company}</span></div>
  <div class="info-row"><span class="info-label">Fecha:</span><span>${m.date}</span></div>
  <div class="info-row"><span class="info-label">Vehículo:</span><span>${m.unit} — ${m.plate}</span></div>
  <div class="info-row"><span class="info-label">Hora:</span><span>${m.time} hrs</span></div>
  <div class="info-row"><span class="info-label">Conductor:</span><span>${m.driver}</span></div>
  <div class="info-row"><span class="info-label">Ruta:</span><span>${m.route}</span></div>
  <div class="info-row"><span class="info-label">Pasajeros:</span><span>${m.passengers}</span></div>
</div>
<table>
  <thead><tr><th>#</th><th>DNI</th><th>Nombre</th><th>Origen</th><th>Destino</th><th>Asiento</th><th>Pago</th><th>Tarifa</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="total">Total recaudado: S/ ${m.revenue.toFixed(2)}</div>
</body></html>`;

  const w = window.open('', '_blank', 'width=800,height=600');
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

function downloadModalPDF() {
  if (!currentModalManifest) return;
  printManifestWindow(currentModalManifest, _currentPassengers);
}

async function downloadPDF(manifestId) {
  const m = ALL_MANIFESTS.find(x => x.id === manifestId);
  if (!m) return;
  try {
    const res        = await authFetch(`/api/manifests/${manifestId}`);
    const data       = await res.json();
    const passengers = (data.passengers || []).map(normalizePassenger);
    printManifestWindow(m, passengers);
  } catch {
    printManifestWindow(m, []);
  }
}

function shareWhatsApp() {
  if (!currentModalManifest) return;
  const m    = currentModalManifest;
  const text = encodeURIComponent(
    `*Manifiesto ${m.num}*\n` +
    `📅 ${m.date} ${m.time} hrs\n` +
    `🚌 Vehículo ${m.unit} (${m.plate})\n` +
    `👤 Conductor: ${m.driver}\n` +
    `🛣️  Ruta: ${m.route}\n` +
    `👥 Pasajeros: ${m.passengers}\n` +
    `💰 Recaudación: S/ ${m.revenue.toFixed(2)}\n` +
    `Estado: ${STATUS_LABEL[m.status]}`
  );
  window.open(`https://wa.me/?text=${text}`, '_blank');
}

function whatsapp(id) {
  currentModalManifest = ALL_MANIFESTS.find(m => m.id === id) || null;
  shareWhatsApp();
}

function exportPDF() { window.print(); }

window.exportCSV        = exportCSV;
window.exportPDF        = exportPDF;
window.downloadModalPDF = downloadModalPDF;
window.downloadPDF      = downloadPDF;
window.shareWhatsApp    = shareWhatsApp;
window.whatsapp         = whatsapp;


/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
(function init() {
  const today = new Date().toISOString().slice(0, 10);
  const fromEl = document.getElementById('filterFrom');
  if (fromEl) fromEl.value = today;

  loadManifests();
})();
