/* ============================================================
   manifests.js — Lógica de la página de Manifiestos
   Chaski AI v2.0
   ============================================================
   Contenido:
   1.  Autenticación y sesión
   2.  Datos demo (manifiestos + pasajeros)
   3.  Filtros y búsqueda
   4.  Renderizado de tabla con paginación
   5.  Ordenamiento de columnas
   6.  KPI mini-row
   7.  Modal de detalle
   8.  Exportar CSV / PDF (básico)
   9.  Reloj / fecha en header
   ============================================================ */

'use strict';

/* ============================================================
   1. AUTENTICACIÓN Y SESIÓN
   ============================================================ */
(function checkAuth() {
  const session = JSON.parse(localStorage.getItem('chaski_user') || 'null');
  if (!session || session.role !== 'admin') {
    window.location.href = '/login';
    return;
  }
  const nameEl = document.getElementById('adminUserName');
  if (nameEl) nameEl.textContent = session.name || 'Admin';
})();

function logout() {
  localStorage.removeItem('chaski_user');
  window.location.href = '/login';
}
window.logout = logout;


/* ============================================================
   2. DATOS DEMO
   ============================================================ */
const COMPANIES = ['Virgen de Fátima', 'Surandino', 'San Francisco de Borja', 'Virgen de Fátima II', 'San Miguel'];
const COMPANY_KEYS = ['fatima', 'surandino', 'borja', 'fatima2', 'sanmiguel'];

const DRIVERS_LIST = ['Eloy Mamani', 'José Quispe', 'Abraham Morales', 'Juan Pérez', 'Carlos Ticona'];

const STATUS_LIST = ['completed', 'completed', 'completed', 'transit', 'pending'];

/** Genera un conjunto de manifiestos demo */
function generateManifests() {
  const manifests = [];
  const now  = new Date();
  let   id   = 1;

  for (let d = 0; d < 7; d++) {
    const day = new Date(now);
    day.setDate(now.getDate() - d);
    const dateStr = day.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // 3–6 manifiestos por día
    const count = Math.floor(Math.random() * 4) + 3;

    for (let i = 0; i < count; i++) {
      const cIdx      = Math.floor(Math.random() * COMPANIES.length);
      const dIdx      = Math.floor(Math.random() * DRIVERS_LIST.length);
      const unit      = String(cIdx * 12 + i + 1).padStart(3, '0');
      const plate     = `PUN-${unit}`;
      const status    = d === 0 ? STATUS_LIST[Math.floor(Math.random() * STATUS_LIST.length)] : 'completed';
      const passengers = Math.floor(Math.random() * 20) + 5;
      const revenue   = passengers * 7.0;
      const hour      = String(Math.floor(Math.random() * 14) + 6).padStart(2, '0');
      const min       = String(Math.floor(Math.random() * 60)).padStart(2, '0');

      manifests.push({
        id:         id++,
        num:        `MAN-${String(id).padStart(5, '0')}`,
        date:       dateStr,
        dateObj:    new Date(day),
        time:       `${hour}:${min}`,
        companyIdx: cIdx,
        company:    COMPANIES[cIdx],
        companyKey: COMPANY_KEYS[cIdx],
        unit,
        plate,
        driver:     DRIVERS_LIST[dIdx],
        route:      'Juli → Puno',
        passengers,
        revenue,
        status,
      });
    }
  }
  return manifests.sort((a, b) => b.dateObj - a.dateObj || b.time.localeCompare(a.time));
}

/** Genera lista de pasajeros demo para un manifiesto */
function generatePassengers(manifest) {
  const ORIGINS  = ['Juli', 'Pomata', 'Zepita', 'Desaguadero', 'Ilave'];
  const DESTS    = ['Puno', 'Juliaca', 'Arequipa'];
  const PAYMENTS = ['Efectivo', 'Yape', 'Plin'];
  const result   = [];

  for (let i = 0; i < manifest.passengers; i++) {
    const dni = String(Math.floor(Math.random() * 90000000) + 10000000);
    const fn  = ['Carlos', 'María', 'Luis', 'Ana', 'Jorge', 'Rosa', 'Pedro', 'Elena'][Math.floor(Math.random() * 8)];
    const ln  = ['Mamani', 'Quispe', 'Huanca', 'Apaza', 'Condori', 'Larico'][Math.floor(Math.random() * 6)];

    result.push({
      num:     i + 1,
      dni,
      name:    `${fn} ${ln}`,
      origin:  ORIGINS[Math.floor(Math.random() * ORIGINS.length)],
      dest:    DESTS[Math.floor(Math.random() * DESTS.length)],
      seat:    String(i + 1).padStart(2, '0'),
      payment: PAYMENTS[Math.floor(Math.random() * PAYMENTS.length)],
      fare:    7.0,
    });
  }
  return result;
}

/* Dataset global */
const ALL_MANIFESTS = generateManifests();


/* ============================================================
   3. FILTROS Y BÚSQUEDA
   ============================================================ */
let filteredData  = [...ALL_MANIFESTS];
let currentPage   = 1;
let sortKey       = 'date';
let sortDir       = 'desc';  // 'asc' | 'desc'

/** Lee todos los controles de filtro y filtra el dataset */
function applyFilters() {
  const text       = (document.getElementById('searchInput')?.value    || '').toLowerCase().trim();
  const company    = document.getElementById('filterCompany')?.value   || '';
  const status     = document.getElementById('filterStatus')?.value    || '';
  const fromInput  = document.getElementById('filterFrom')?.value      || '';
  const toInput    = document.getElementById('filterTo')?.value        || '';

  const fromDate = fromInput ? new Date(fromInput) : null;
  const toDate   = toInput   ? new Date(toInput + 'T23:59:59') : null;

  filteredData = ALL_MANIFESTS.filter(m => {
    /* Búsqueda por texto: número, placa, código, conductor */
    if (text) {
      const haystack = `${m.num} ${m.plate} ${m.unit} ${m.driver}`.toLowerCase();
      if (!haystack.includes(text)) return false;
    }
    /* Empresa */
    if (company && m.companyKey !== company) return false;
    /* Estado */
    if (status && m.status !== status) return false;
    /* Rango de fechas */
    if (fromDate && m.dateObj < fromDate) return false;
    if (toDate   && m.dateObj > toDate)   return false;

    return true;
  });

  currentPage = 1;
  updateKPIs();
  renderTable();
}

/** Limpia todos los filtros */
function clearFilters() {
  document.getElementById('searchInput').value  = '';
  document.getElementById('filterCompany').value = '';
  document.getElementById('filterStatus').value  = '';
  document.getElementById('filterFrom').value    = '';
  document.getElementById('filterTo').value      = '';
  filteredData = [...ALL_MANIFESTS];
  currentPage  = 1;
  updateKPIs();
  renderTable();
}

/* Exponer al scope global */
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;

/* Búsqueda en tiempo real al escribir */
document.getElementById('searchInput')?.addEventListener('input', applyFilters);


/* ============================================================
   4. RENDERIZADO DE TABLA CON PAGINACIÓN
   ============================================================ */
const STATUS_LABEL = {
  completed: 'Completado',
  pending:   'Pendiente',
  transit:   'En tránsito',
};

const STATUS_ICON = {
  completed: 'fa-check-circle',
  pending:   'fa-clock',
  transit:   'fa-truck-moving',
};

function renderTable() {
  const tbody  = document.getElementById('manifestBody');
  const perPage = parseInt(document.getElementById('rowsPerPage')?.value || '10');
  const total   = filteredData.length;
  const pages   = Math.max(1, Math.ceil(total / perPage));

  if (currentPage > pages) currentPage = pages;

  const start = (currentPage - 1) * perPage;
  const slice = filteredData.slice(start, start + perPage);

  /* Actualizar contador */
  const countEl = document.getElementById('resultsCount');
  if (countEl) {
    countEl.innerHTML = `Mostrando <strong>${total}</strong> manifiestos`;
  }

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

/** Renderiza los botones de paginación */
function renderPagination(pages) {
  const cont = document.getElementById('pagination');
  if (!cont) return;

  let html = '';
  html += `<button class="pg-btn" onclick="goPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>
             <i class="fas fa-chevron-left"></i>
           </button>`;

  /* Páginas visibles: siempre mostrar 1, last y hasta 3 alrededor de la actual */
  const visible = new Set([1, pages]);
  for (let p = Math.max(2, currentPage - 1); p <= Math.min(pages - 1, currentPage + 1); p++) {
    visible.add(p);
  }
  const sorted = [...visible].sort((a, b) => a - b);

  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) html += `<span class="pg-info">…</span>`;
    html += `<button class="pg-btn ${p === currentPage ? 'active' : ''}" onclick="goPage(${p})">${p}</button>`;
    prev = p;
  }

  html += `<button class="pg-btn" onclick="goPage(${currentPage + 1})" ${currentPage >= pages ? 'disabled' : ''}>
             <i class="fas fa-chevron-right"></i>
           </button>`;
  html += `<span class="pg-info">Pág. ${currentPage} / ${pages}</span>`;

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
      case 'num':        va = a.id;          vb = b.id;          break;
      case 'date':       va = a.dateObj;     vb = b.dateObj;     break;
      case 'driver':     va = a.driver;      vb = b.driver;      break;
      case 'passengers': va = a.passengers;  vb = b.passengers;  break;
      case 'revenue':    va = a.revenue;     vb = b.revenue;     break;
      default:           va = a.id;          vb = b.id;
    }
    if (va < vb) return sortDir === 'asc' ? -1 :  1;
    if (va > vb) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });

  /* Actualizar iconos de cabecera */
  document.querySelectorAll('th.sortable').forEach(th => {
    th.classList.remove('asc', 'desc');
  });
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
  /* Solo consideramos los manifiestos de hoy para los KPIs */
  const todayStr = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const todays   = ALL_MANIFESTS.filter(m => m.date === todayStr);

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

/** Contador animado (easing) */
function animateKPI(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start    = 0;
  const duration = 900;
  const startTs  = performance.now();
  function step(ts) {
    const t = Math.min((ts - startTs) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(start + (target - start) * ease);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}


/* ============================================================
   7. MODAL DE DETALLE
   ============================================================ */
let currentModalManifest = null;

function openModal(manifestId) {
  const manifest = ALL_MANIFESTS.find(m => m.id === manifestId);
  if (!manifest) return;
  currentModalManifest = manifest;

  /* Encabezado */
  document.getElementById('modalManifestNum').textContent  = manifest.num;
  document.getElementById('modalManifestMeta').textContent =
    `${manifest.date} — ${manifest.time} hrs · ${manifest.company}`;

  /* Info del viaje */
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

  /* Tabla de pasajeros */
  const passengers = generatePassengers(manifest);
  const tbody = document.getElementById('modalPassBody');
  if (tbody) {
    tbody.innerHTML = passengers.map(p => `
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

  /* Resumen por tipo de pago */
  const byPayment = passengers.reduce((acc, p) => {
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

    const totalRevenue = manifest.revenue.toFixed(2);
    const totalPass    = manifest.passengers;

    summaryEl.innerHTML = `
      <div class="ms-item">
        <span class="ms-val">${totalPass}</span>
        <span class="ms-lbl">Pasajeros</span>
      </div>
      ${items}
      <div class="ms-item">
        <span class="ms-val gold">S/ ${totalRevenue}</span>
        <span class="ms-lbl">Total recaudado</span>
      </div>
    `;
  }

  /* Abrir modal */
  document.getElementById('manifestModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('manifestModal').classList.remove('open');
  document.body.style.overflow = '';
  currentModalManifest = null;
}

/* Cerrar al hacer click en el overlay */
document.getElementById('manifestModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

window.openModal  = openModal;
window.closeModal = closeModal;


/* ============================================================
   8. EXPORTAR CSV / PDF (básico con datos demo)
   ============================================================ */

/** Descarga un CSV de los manifiestos filtrados */
function exportCSV() {
  const headers = ['N° Manifiesto', 'Fecha', 'Hora', 'Empresa', 'Vehículo', 'Placa',
                   'Conductor', 'Ruta', 'Pasajeros', 'Recaudación', 'Estado'];
  const rows = filteredData.map(m => [
    m.num, m.date, m.time, m.company, m.unit, m.plate,
    m.driver, m.route, m.passengers, `S/ ${m.revenue.toFixed(2)}`, STATUS_LABEL[m.status]
  ]);

  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `manifiestos_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Muestra ventana de impresión del manifiesto actual */
function downloadModalPDF() {
  window.print();
}

function downloadPDF(id) {
  openModal(id);
  setTimeout(() => window.print(), 400);
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
  currentModalManifest = ALL_MANIFESTS.find(m => m.id === id);
  shareWhatsApp();
}

function exportPDF() { window.print(); }

window.exportCSV          = exportCSV;
window.exportPDF          = exportPDF;
window.downloadModalPDF   = downloadModalPDF;
window.downloadPDF        = downloadPDF;
window.shareWhatsApp      = shareWhatsApp;
window.whatsapp           = whatsapp;


/* ============================================================
   9. RELOJ Y FECHA EN HEADER
   ============================================================ */
function updateClock() {
  const now  = new Date();
  const time = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const clockEl = document.getElementById('adminClock');
  const dateEl  = document.getElementById('adminDate');
  if (clockEl) clockEl.textContent = time;
  if (dateEl)  dateEl.textContent  = date.charAt(0).toUpperCase() + date.slice(1);
}
setInterval(updateClock, 1000);
updateClock();


/* ============================================================
   SIDEBAR TOGGLE
   ============================================================ */
document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar')?.classList.toggle('collapsed');
  document.getElementById('adminMain')?.classList.toggle('expanded');
});


/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
(function init() {
  /* Setear fecha de hoy en filtro "Desde" por defecto */
  const today = new Date().toISOString().slice(0, 10);
  const fromEl = document.getElementById('filterFrom');
  if (fromEl) fromEl.value = today;

  filteredData = [...ALL_MANIFESTS];
  updateKPIs();
  renderTable();
})();
