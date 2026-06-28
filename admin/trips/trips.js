/* ============================================================
   trips.js — Lógica de la página de Viajes
   Chaski AI v2.0
   ============================================================
   Contenido:
   1.  Autenticación y sesión
   2.  Datos demo (viajes + alertas)
   3.  Selector de período
   4.  KPI cards
   5.  Gráficos (línea hora, donut empresa, barras pasajeros/día)
   6.  Lista de alertas de velocidad
   7.  Tabla de viajes con búsqueda y paginación
   8.  Reloj y sidebar toggle
   ============================================================ */

'use strict';

/* ============================================================
   1. AUTENTICACIÓN
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
const COMPANIES  = ['Virgen de Fátima', 'Surandino', 'San Francisco de Borja', 'Virgen de Fátima II', 'San Miguel'];
const DRIVERS    = ['Eloy Mamani', 'José Quispe', 'Abraham Morales', 'Juan Pérez', 'Carlos Ticona'];
const ROUTE_NAME = 'Juli → Puno';
const ROUTE_KM   = 98.5;

/** Genera registros de viajes para los últimos N días */
function generateTrips(days = 30) {
  const trips  = [];
  const now    = new Date();
  let   id     = 1;

  for (let d = 0; d < days; d++) {
    const day   = new Date(now);
    day.setDate(now.getDate() - d);

    const count = Math.floor(Math.random() * 8) + 4; // 4-11 viajes por día

    for (let i = 0; i < count; i++) {
      const dIdx      = Math.floor(Math.random() * DRIVERS.length);
      const cIdx      = Math.floor(Math.random() * COMPANIES.length);
      const unit      = String(cIdx * 12 + dIdx + 1).padStart(3, '0');
      const plate     = `PUN-${unit}`;
      const hour      = Math.floor(Math.random() * 14) + 6;
      const min       = Math.floor(Math.random() * 60);

      const departure = new Date(day);
      departure.setHours(hour, min, 0);

      const durationMin = Math.floor(Math.random() * 30) + 70; // 70-100 min
      const arrival     = new Date(departure.getTime() + durationMin * 60000);

      const passengers  = Math.floor(Math.random() * 22) + 4;
      const revenue     = passengers * 7.0;
      const maxSpeed    = Math.floor(Math.random() * 30) + 80; // 80-110 km/h
      const avgSpeed    = Math.floor(ROUTE_KM / (durationMin / 60));
      const hasAlert    = maxSpeed > 90;
      const status      = d === 0 && hour >= new Date().getHours() - 1
                          ? (Math.random() > 0.5 ? 'transit' : 'completed')
                          : 'completed';

      trips.push({
        id, unit, plate,
        driver:      DRIVERS[dIdx],
        companyIdx:  cIdx,
        company:     COMPANIES[cIdx],
        route:       ROUTE_NAME,
        departure:   departure,
        arrival:     arrival,
        durationMin,
        passengers,
        revenue,
        maxSpeed,
        avgSpeed,
        hasAlert,
        status,
        day:         d, // 0 = hoy
      });
      id++;
    }
  }
  return trips.sort((a, b) => b.departure - a.departure);
}

const ALL_TRIPS = generateTrips(30);

/** Genera alertas de velocidad a partir de los viajes */
const SPEED_ALERTS = ALL_TRIPS
  .filter(t => t.hasAlert && t.day <= 1)
  .slice(0, 12)
  .map(t => ({
    unit:    t.unit,
    driver:  t.driver,
    speed:   t.maxSpeed,
    time:    t.departure.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    date:    t.departure.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' }),
  }));


/* ============================================================
   3. SELECTOR DE PERÍODO
   ============================================================ */
let currentPeriod = 'today';
let periodTrips   = [];

const PERIOD_LABELS = {
  today:  'Hoy',
  week:   'Esta semana (últimos 7 días)',
  month:  'Este mes (últimos 30 días)',
  custom: 'Período personalizado',
};

function setPeriod(period, btn) {
  currentPeriod = period;
  document.querySelectorAll('.tr-period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  /* Mostrar / ocultar fechas personalizadas */
  const customEl = document.getElementById('customDates');
  if (customEl) customEl.classList.toggle('visible', period === 'custom');

  if (period !== 'custom') {
    filterByPeriod(period);
    updateAll();
  }

  const lbl = document.getElementById('periodLabel');
  if (lbl) lbl.textContent = 'Mostrando: ' + PERIOD_LABELS[period];
}

function filterByPeriod(period) {
  switch (period) {
    case 'today':  periodTrips = ALL_TRIPS.filter(t => t.day === 0);         break;
    case 'week':   periodTrips = ALL_TRIPS.filter(t => t.day < 7);           break;
    case 'month':  periodTrips = ALL_TRIPS;                                   break;
    default:       periodTrips = ALL_TRIPS.filter(t => t.day === 0);
  }
}

function applyCustomPeriod() {
  const from = document.getElementById('trFrom')?.value;
  const to   = document.getElementById('trTo')?.value;
  if (!from || !to) return;

  const fromDate = new Date(from);
  const toDate   = new Date(to + 'T23:59:59');

  periodTrips = ALL_TRIPS.filter(t => t.departure >= fromDate && t.departure <= toDate);
  updateAll();

  const lbl = document.getElementById('periodLabel');
  if (lbl) lbl.textContent = `${from} — ${to}`;
}

window.setPeriod          = setPeriod;
window.applyCustomPeriod  = applyCustomPeriod;


/* ============================================================
   4. KPI CARDS
   ============================================================ */
function updateKPIs() {
  const trips     = periodTrips;
  const totalTrips = trips.length;
  const totalPax  = trips.reduce((s, t) => s + t.passengers, 0);
  const totalKm   = totalTrips * ROUTE_KM;
  const avgSpeed  = trips.length
    ? Math.round(trips.reduce((s, t) => s + t.avgSpeed, 0) / trips.length)
    : 0;
  const revenue   = trips.reduce((s, t) => s + t.revenue, 0);
  const alerts    = trips.filter(t => t.hasAlert).length;

  animKPI('kpiTrips',    totalTrips);
  animKPI('kpiPax',      totalPax);
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
  color:  'rgba(0,200,255,0.85)',
  grid:   'rgba(255,255,255,0.05)',
  text:   '#8892a4',
  font:   "'Inter', sans-serif",
};

function initCharts() {
  Chart.defaults.color         = CHART_DEFAULTS.text;
  Chart.defaults.font.family   = CHART_DEFAULTS.font;
  Chart.defaults.font.size     = 11;

  /* --- Viajes por hora del día --- */
  const hourCounts = Array(24).fill(0);
  ALL_TRIPS.filter(t => t.day === 0).forEach(t => {
    hourCounts[t.departure.getHours()]++;
  });

  const ctxHour = document.getElementById('chartTripsHour')?.getContext('2d');
  if (ctxHour) {
    chartHour = new Chart(ctxHour, {
      type: 'line',
      data: {
        labels: Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2,'0')}:00`),
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

  /* --- Viajes por empresa (hoy) --- */
  const companyCounts = COMPANIES.map((c, ci) =>
    ALL_TRIPS.filter(t => t.day === 0 && t.companyIdx === ci).length
  );
  const companyColors = [
    'rgba(0,200,255,0.8)', 'rgba(0,255,148,0.8)', 'rgba(255,184,0,0.8)',
    'rgba(255,68,68,0.8)', 'rgba(138,80,255,0.8)',
  ];

  const ctxComp = document.getElementById('chartTripsCompany')?.getContext('2d');
  if (ctxComp) {
    chartCompany = new Chart(ctxComp, {
      type: 'doughnut',
      data: {
        labels: COMPANIES,
        datasets: [{
          data: companyCounts,
          backgroundColor: companyColors,
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
    const dd = new Date();
    dd.setDate(dd.getDate() - d);
    dayLabels.push(dd.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric' }));
    const pax = ALL_TRIPS.filter(t => t.day === d).reduce((s, t) => s + t.passengers, 0);
    dayPax.push(pax);
  }

  const ctxPass = document.getElementById('chartPassDay')?.getContext('2d');
  if (ctxPass) {
    chartPassDay = new Chart(ctxPass, {
      type: 'bar',
      data: {
        labels: dayLabels,
        datasets: [{
          label: 'Pasajeros',
          data: dayPax,
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

  if (SPEED_ALERTS.length === 0) {
    list.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:20px;font-size:13px">
      Sin alertas registradas
    </p>`;
    return;
  }

  list.innerHTML = SPEED_ALERTS.map(a => `
    <div class="tr-alert-item">
      <div class="tr-alert-icon"><i class="fas fa-exclamation-triangle"></i></div>
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
  const tbody    = document.getElementById('tripsBody');
  const search   = (document.getElementById('tripsSearch')?.value || '').toLowerCase();
  const perPage  = 10;

  const source   = periodTrips.filter(t => {
    if (!search) return true;
    return `${t.unit} ${t.plate} ${t.driver}`.toLowerCase().includes(search);
  });

  filteredTrips  = source;
  const total    = source.length;
  const pages    = Math.max(1, Math.ceil(total / perPage));
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
      const arr = t.arrival.toLocaleTimeString  ('es-PE', { hour: '2-digit', minute: '2-digit' });
      const dur = `${Math.floor(t.durationMin / 60)}h ${t.durationMin % 60}m`;
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
          <td>${t.status === 'transit' ? '<span style="color:var(--primary)">En ruta</span>' : arr}</td>
          <td style="color:var(--text-sub)">${dur}</td>
          <td style="text-align:center;font-weight:600">${t.passengers}</td>
          <td ${speedClass}>${t.maxSpeed} km/h ${t.hasAlert ? '<i class="fas fa-exclamation-triangle" style="color:var(--danger);font-size:11px"></i>' : ''}</td>
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

  let html = `<button class="pg-btn" onclick="tripsGoPage(${tripsPage-1})" ${tripsPage<=1?'disabled':''}>
    <i class="fas fa-chevron-left"></i></button>`;

  for (let p = 1; p <= pages; p++) {
    html += `<button class="pg-btn ${p===tripsPage?'active':''}" onclick="tripsGoPage(${p})">${p}</button>`;
  }

  html += `<button class="pg-btn" onclick="tripsGoPage(${tripsPage+1})" ${tripsPage>=pages?'disabled':''}>
    <i class="fas fa-chevron-right"></i></button>
    <span class="pg-info">Pág. ${tripsPage} / ${pages}</span>`;
  cont.innerHTML = html;
}

function tripsGoPage(p) {
  const perPage = 10;
  const pages   = Math.max(1, Math.ceil(filteredTrips.length / perPage));
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
}


/* ============================================================
   RELOJ Y SIDEBAR
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

document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar')?.classList.toggle('collapsed');
  document.getElementById('adminMain')?.classList.toggle('expanded');
});


/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
(function init() {
  filterByPeriod('today');
  updateAll();
  initCharts();
})();
