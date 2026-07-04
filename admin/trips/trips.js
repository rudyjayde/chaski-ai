/* ============================================================
   trips.js — Lógica de la página de Viajes
   Chaski AI v2.0 — Datos reales desde API REST
   ============================================================ */

'use strict';

/* ============================================================
   1. HELPER DE AUTENTICACIÓN — delega a window.authFetch (core.js)
   ============================================================ */
function authFetch(path, opts = {}) {
  return window.authFetch(path, opts);
}


/* ============================================================
   2. NORMALIZACIÓN Y CARGA DESDE API
   ============================================================ */
const ROUTE_KM = 98.5;

let ALL_TRIPS         = [];
let SPEED_ALERTS_DATA = [];

function normalizeTrip(t) {
  const dep         = new Date(t.start_time);
  const arr         = t.end_time ? new Date(t.end_time) : null;
  const durationMin = arr ? Math.round((arr - dep) / 60000) : 90;
  const maxSpeed    = parseFloat(t.max_speed) || 0;

  return {
    id:          t.id,
    unit:        t.association_code || '—',
    plate:       t.plate || '—',
    driver:      t.driver_name || '—',
    company:     t.company_name || t.association_code || '—',
    route:       t.route_name || '—',
    departure:   dep,
    arrival:     arr,
    durationMin,
    passengers:  parseInt(t.total_passengers) || 0,
    revenue:     parseFloat(t.revenue) || 0,
    maxSpeed,
    avgSpeed:    parseFloat(t.avg_speed) || Math.round(ROUTE_KM / (durationMin / 60)),
    hasAlert:    maxSpeed > 90,
    status:      t.status === 'active' ? 'transit' : t.status === 'completed' ? 'completed' : 'pending',
  };
}

async function loadTrips(from, to) {
  try {
    const res = await authFetch(`/api/trips?from=${from}&to=${to}&limit=500`);
    const data = await res.json();
    ALL_TRIPS  = Array.isArray(data) ? data.map(normalizeTrip) : [];
  } catch (err) {
    console.error('[Trips] Error al cargar:', err.message);
    ALL_TRIPS = [];
  }
}

async function loadSpeedAlerts() {
  try {
    const res = await authFetch('/api/reports/alerts?limit=12');
    const data = await res.json();
    SPEED_ALERTS_DATA = Array.isArray(data) ? data.map(a => ({
      unit:   a.association_code || '—',
      driver: a.driver_name || '—',
      speed:  parseFloat(a.max_speed) || 0,
      time:   new Date(a.occurred_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
      date:   new Date(a.occurred_at).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' }),
    })) : [];
  } catch (err) {
    console.error('[SpeedAlerts] Error:', err.message);
    SPEED_ALERTS_DATA = [];
  }
}


/* ============================================================
   3. SELECTOR DE PERÍODO
   ============================================================ */
let currentPeriod = 'today';

const PERIOD_LABELS = {
  today:  'Hoy',
  week:   'Esta semana (últimos 7 días)',
  month:  'Este mes (últimos 30 días)',
  custom: 'Período personalizado',
};

function getDateRange(period) {
  const today = new Date().toISOString().split('T')[0];
  if (period === 'week') {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return { from: d.toISOString().split('T')[0], to: today };
  }
  if (period === 'month') {
    const d = new Date(); d.setDate(d.getDate() - 29);
    return { from: d.toISOString().split('T')[0], to: today };
  }
  return { from: today, to: today };
}

async function setPeriod(period, btn) {
  currentPeriod = period;
  document.querySelectorAll('.tr-period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const customEl = document.getElementById('customDates');
  if (customEl) customEl.classList.toggle('visible', period === 'custom');

  if (period !== 'custom') {
    const { from, to } = getDateRange(period);
    await loadTrips(from, to);
    updateAll();
  }

  const lbl = document.getElementById('periodLabel');
  if (lbl) lbl.textContent = 'Mostrando: ' + PERIOD_LABELS[period];
}

async function applyCustomPeriod() {
  const from = document.getElementById('trFrom')?.value;
  const to   = document.getElementById('trTo')?.value;
  if (!from || !to) return;

  await loadTrips(from, to);
  updateAll();

  const lbl = document.getElementById('periodLabel');
  if (lbl) lbl.textContent = `${from} — ${to}`;
}

window.setPeriod         = setPeriod;
window.applyCustomPeriod = applyCustomPeriod;


/* ============================================================
   4. KPI CARDS
   ============================================================ */
function updateKPIs() {
  const totalKm  = ALL_TRIPS.length * ROUTE_KM;
  const avgSpeed = ALL_TRIPS.length
    ? Math.round(ALL_TRIPS.reduce((s, t) => s + t.avgSpeed, 0) / ALL_TRIPS.length)
    : 0;
  const revenue  = ALL_TRIPS.reduce((s, t) => s + t.revenue, 0);
  const alerts   = ALL_TRIPS.filter(t => t.hasAlert).length;

  animKPI('kpiTrips',    ALL_TRIPS.length);
  animKPI('kpiPax',      ALL_TRIPS.reduce((s, t) => s + t.passengers, 0));
  animKPI('kpiKm',       Math.round(totalKm));
  animKPI('kpiAvgSpeed', avgSpeed);
  animKPI('kpiAlerts',   alerts);

  const revEl = document.getElementById('kpiRev');
  if (revEl) revEl.textContent = `S/ ${revenue.toFixed(2)}`;

  const alertCountEl = document.getElementById('alertCount');
  if (alertCountEl) alertCountEl.textContent = alerts;
}

function animKPI(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const dur = 900, t0 = performance.now();
  function step(ts) {
    const p = Math.min((ts - t0) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * e);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}


/* ============================================================
   5. GRÁFICOS
   ============================================================ */
let chartHour    = null;
let chartCompany = null;
let chartPassDay = null;

const CHART_DEFAULTS = {
  grid: 'rgba(255,255,255,0.05)',
  text: '#8892a4',
  font: "'Inter', sans-serif",
};

const COMPANY_COLORS = [
  'rgba(0,200,255,0.8)', 'rgba(0,255,148,0.8)', 'rgba(255,184,0,0.8)',
  'rgba(255,68,68,0.8)', 'rgba(138,80,255,0.8)',
];

function buildCharts() {
  Chart.defaults.color       = CHART_DEFAULTS.text;
  Chart.defaults.font.family = CHART_DEFAULTS.font;
  Chart.defaults.font.size   = 11;

  /* --- Viajes por hora del día (hoy) --- */
  const hourCounts = Array(24).fill(0);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(todayStart.getTime() + 86400000);
  ALL_TRIPS.filter(t => t.departure >= todayStart && t.departure < todayEnd)
    .forEach(t => { hourCounts[t.departure.getHours()]++; });

  const ctxHour = document.getElementById('chartTripsHour')?.getContext('2d');
  if (ctxHour) {
    if (chartHour) chartHour.destroy();
    chartHour = new Chart(ctxHour, {
      type: 'line',
      data: {
        labels: Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`),
        datasets: [{
          label: 'Viajes',
          data:  hourCounts,
          borderColor: 'rgba(0,200,255,0.9)',
          backgroundColor: 'rgba(0,200,255,0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 3,
          pointBackgroundColor: 'rgba(0,200,255,1)',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: CHART_DEFAULTS.grid } },
          y: { grid: { color: CHART_DEFAULTS.grid }, beginAtZero: true, ticks: { stepSize: 1 } },
        },
      },
    });
  }

  /* --- Viajes por empresa --- */
  const companyMap = {};
  ALL_TRIPS.forEach(t => { companyMap[t.company] = (companyMap[t.company] || 0) + 1; });
  const companyEntries = Object.entries(companyMap).sort((a, b) => b[1] - a[1]);

  const ctxComp = document.getElementById('chartTripsCompany')?.getContext('2d');
  if (ctxComp) {
    if (chartCompany) chartCompany.destroy();
    chartCompany = new Chart(ctxComp, {
      type: 'doughnut',
      data: {
        labels: companyEntries.map(e => e[0]),
        datasets: [{
          data: companyEntries.map(e => e[1]),
          backgroundColor: COMPANY_COLORS.slice(0, companyEntries.length),
          borderColor: '#0d1224',
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12, font: { size: 10 } } },
        },
        cutout: '60%',
      },
    });
  }

  /* --- Pasajeros por día (últimos 7 días) --- */
  const dayLabels = [];
  const dayPax    = [];
  for (let d = 6; d >= 0; d--) {
    const dd = new Date(); dd.setDate(dd.getDate() - d); dd.setHours(0, 0, 0, 0);
    const next = new Date(dd.getTime() + 86400000);
    dayLabels.push(dd.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric' }));
    dayPax.push(ALL_TRIPS.filter(t => t.departure >= dd && t.departure < next).reduce((s, t) => s + t.passengers, 0));
  }

  const ctxPass = document.getElementById('chartPassDay')?.getContext('2d');
  if (ctxPass) {
    if (chartPassDay) chartPassDay.destroy();
    chartPassDay = new Chart(ctxPass, {
      type: 'bar',
      data: {
        labels: dayLabels,
        datasets: [{
          label: 'Pasajeros',
          data:   dayPax,
          backgroundColor: 'rgba(0,255,148,0.6)',
          borderColor: 'rgba(0,255,148,0.9)',
          borderWidth: 1,
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: CHART_DEFAULTS.grid } },
          y: { grid: { color: CHART_DEFAULTS.grid }, beginAtZero: true },
        },
      },
    });
  }
}


/* ============================================================
   6. LISTA DE ALERTAS DE VELOCIDAD
   ============================================================ */
function renderSpeedAlerts() {
  const list = document.getElementById('speedAlertsList');
  if (!list) return;

  if (SPEED_ALERTS_DATA.length === 0) {
    list.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:20px;font-size:13px">
      Sin alertas registradas
    </p>`;
    return;
  }

  list.innerHTML = SPEED_ALERTS_DATA.map(a => `
    <div class="tr-alert-item">
      <div class="tr-alert-icon"><i data-lucide="alert-triangle"></i></div>
      <div class="tr-alert-body">
        <div class="tr-alert-title">Unidad ${a.unit} — ${a.driver}</div>
        <div class="tr-alert-sub">${a.date} ${a.time} hrs</div>
      </div>
      <span class="tr-alert-speed">${a.speed} km/h</span>
    </div>
  `).join('');
}


/* ============================================================
   7. TABLA DE VIAJES
   ============================================================ */
const STATUS_LABEL = { completed: 'Completado', transit: 'En tránsito', pending: 'Pendiente' };
const STATUS_ICON  = { completed: 'fa-check-circle', transit: 'fa-truck-moving', pending: 'fa-clock' };

let tripsPage     = 1;
let filteredTrips = [];

function renderTripsTable() {
  const tbody   = document.getElementById('tripsBody');
  const search  = (document.getElementById('tripsSearch')?.value || '').toLowerCase();
  const perPage = 10;

  const source = ALL_TRIPS.filter(t => {
    if (!search) return true;
    return `${t.unit} ${t.plate} ${t.driver}`.toLowerCase().includes(search);
  });

  filteredTrips = source;
  const total   = source.length;
  const pages   = Math.max(1, Math.ceil(total / perPage));
  if (tripsPage > pages) tripsPage = pages;

  const slice = source.slice((tripsPage - 1) * perPage, tripsPage * perPage);

  if (!tbody) return;

  if (slice.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="11" style="text-align:center;padding:30px;color:var(--text-muted)">
        Sin viajes registrados para este período
      </td></tr>`;
  } else {
    tbody.innerHTML = slice.map(t => {
      const dep = t.departure.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      const arr = t.arrival
        ? t.arrival.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
        : '<span style="color:var(--primary)">En ruta</span>';
      const dur = t.arrival ? `${Math.floor(t.durationMin / 60)}h ${t.durationMin % 60}m` : '—';
      const speedClass = t.maxSpeed > 90 ? 'style="color:var(--danger);font-weight:700"' : '';

      return `
        <tr>
          <td>
            <span style="font-family:'Rajdhani',sans-serif;font-weight:700;color:var(--primary)">${t.unit}</span>
            <small style="color:var(--text-muted);display:block">${t.plate}</small>
          </td>
          <td>${t.driver}</td>
          <td style="color:var(--text-sub);font-size:12px">${t.company}</td>
          <td style="color:var(--text-sub)">${t.route}</td>
          <td>${dep}</td>
          <td>${arr}</td>
          <td style="color:var(--text-sub)">${dur}</td>
          <td style="text-align:center;font-weight:600">${t.passengers}</td>
          <td ${speedClass}>${t.maxSpeed} km/h ${t.hasAlert ? '<i data-lucide="alert-triangle"></i>' : ''}</td>
          <td style="color:var(--gold);font-weight:600">S/ ${t.revenue.toFixed(2)}</td>
          <td>
            <span class="status-badge ${t.status}">
              <i class="fas ${STATUS_ICON[t.status]}"></i> ${STATUS_LABEL[t.status]}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }

  renderTripsPagination(pages);
}

function renderTripsPagination(pages) {
  const cont = document.getElementById('tripsPagination');
  if (!cont) return;

  let html = `<button class="pg-btn" onclick="tripsGoPage(${tripsPage - 1})" ${tripsPage <= 1 ? 'disabled' : ''}>
    <i class="fas fa-chevron-left"></i></button>`;

  for (let p = 1; p <= pages; p++) {
    html += `<button class="pg-btn ${p === tripsPage ? 'active' : ''}" onclick="tripsGoPage(${p})">${p}</button>`;
  }

  html += `<button class="pg-btn" onclick="tripsGoPage(${tripsPage + 1})" ${tripsPage >= pages ? 'disabled' : ''}>
    <i class="fas fa-chevron-right"></i></button>
    <span class="pg-info">Pág. ${tripsPage} / ${pages}</span>`;
  cont.innerHTML = html;
}

function tripsGoPage(p) {
  const pages = Math.max(1, Math.ceil(filteredTrips.length / 10));
  if (p < 1 || p > pages) return;
  tripsPage = p;
  renderTripsTable();
}
window.tripsGoPage = tripsGoPage;

document.getElementById('tripsSearch')?.addEventListener('input', () => {
  tripsPage = 1;
  renderTripsTable();
});


/* ============================================================
   8. ACTUALIZACIÓN COMPLETA
   ============================================================ */
function updateAll() {
  updateKPIs();
  renderSpeedAlerts();
  renderTripsTable();
  buildCharts();
}


/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
(async function init() {
  const today = new Date().toISOString().split('T')[0];
  await Promise.all([loadTrips(today, today), loadSpeedAlerts()]);
  updateAll();
})();
