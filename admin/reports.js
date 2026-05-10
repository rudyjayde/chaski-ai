/* ============================================================
   reports.js — Lógica de la página de Reportes
   Chaski AI v2.0
   ============================================================
   Contenido:
   1.  Autenticación y sesión
   2.  Datos demo del período
   3.  Selector de período
   4.  KPI ejecutivos
   5.  Gráficos (recaudación/empresa, tendencia viajes, pasajeros/semana, pagos, alertas)
   6.  Ranking de conductores
   7.  Tabla resumen por empresa
   8.  Exportar
   9.  Reloj y sidebar toggle
   ============================================================ */

'use strict';

/* ============================================================
   1. AUTENTICACIÓN
   ============================================================ */
(function checkAuth() {
  const session = JSON.parse(localStorage.getItem('chaski_user') || 'null');
  if (!session || session.role !== 'admin') {
    window.location.href = '../login.html';
    return;
  }
  const nameEl = document.getElementById('adminUserName');
  if (nameEl) nameEl.textContent = session.name || 'Admin';
})();

function logout() {
  localStorage.removeItem('chaski_user');
  window.location.href = '../login.html';
}
window.logout = logout;


/* ============================================================
   2. DATOS DEMO POR PERÍODO
   ============================================================ */
const COMPANIES = ['Virgen de Fátima', 'Surandino', 'San Francisco de Borja', 'Virgen de Fátima II', 'San Miguel'];
const COMPANY_FLEET = [14, 12, 11, 13, 10]; // vehículos por empresa

const DRIVERS_NAMES = [
  'Eloy Mamani', 'José Quispe', 'Abraham Morales', 'Juan Pérez', 'Carlos Ticona',
  'Roberto Flores', 'Marcos Huanca', 'David Condori',
];

/**
 * Genera métricas agregadas por empresa para un período dado
 * @param {number} days — número de días del período
 */
function buildCompanyData(days) {
  return COMPANIES.map((company, ci) => {
    const fleet      = COMPANY_FLEET[ci];
    const trips      = Math.floor(fleet * days * (2.5 + Math.random()));
    const passengers = Math.floor(trips * (Math.random() * 8 + 10));
    const revenue    = passengers * 7.0;
    const km         = trips * 98.5;
    const occ        = Math.round((passengers / (trips * 22)) * 100);
    const speedAlerts = Math.floor(trips * 0.05 * Math.random() * 3);

    return { company, ci, fleet, trips, passengers, revenue, km, occ, speedAlerts };
  });
}

/** Genera serie de viajes diarios (para gráfico de tendencia) */
function buildDailyTrips(days) {
  const result = [];
  for (let d = days - 1; d >= 0; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    result.push({
      label: date.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }),
      value: Math.floor(Math.random() * 20) + 30, // 30-50 viajes/día
    });
  }
  return result;
}

/** Genera distribución de pasajeros por día de la semana */
function buildWeekdayData() {
  const days  = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const base  = [380, 420, 400, 450, 500, 320, 260];
  return days.map((d, i) => ({ label: d, value: base[i] + Math.floor(Math.random() * 60 - 30) }));
}

/** Genera distribución de métodos de pago */
function buildPaymentData() {
  const total = 1000;
  const cash  = Math.floor(total * 0.55);
  const yape  = Math.floor(total * 0.3);
  const plin  = total - cash - yape;
  return [
    { label: 'Efectivo', value: cash,  color: 'rgba(0,200,255,0.8)' },
    { label: 'Yape',     value: yape,  color: 'rgba(0,255,148,0.8)' },
    { label: 'Plin',     value: plin,  color: 'rgba(255,184,0,0.8)' },
  ];
}

/* Multiplicadores por período */
const PERIOD_DAYS = { month: 30, quarter: 90, year: 365 };

let currentPeriod   = 'month';
let companyData     = buildCompanyData(30);


/* ============================================================
   3. SELECTOR DE PERÍODO
   ============================================================ */
function setRpPeriod(period, btn) {
  currentPeriod = period;
  document.querySelectorAll('.rp-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const days   = PERIOD_DAYS[period];
  companyData  = buildCompanyData(days);

  updateKPIs();
  renderCompanyTable();
  renderTopDrivers();
  refreshCharts(days);
}

window.setRpPeriod = setRpPeriod;


/* ============================================================
   4. KPI EJECUTIVOS
   ============================================================ */
function updateKPIs() {
  const totTrips    = companyData.reduce((s, c) => s + c.trips,      0);
  const totPax      = companyData.reduce((s, c) => s + c.passengers, 0);
  const totRev      = companyData.reduce((s, c) => s + c.revenue,    0);
  const totKm       = companyData.reduce((s, c) => s + c.km,         0);
  const avgOcc      = Math.round(companyData.reduce((s, c) => s + c.occ, 0) / companyData.length);
  const totAlerts   = companyData.reduce((s, c) => s + c.speedAlerts, 0);

  animKPI('rpTrips',   totTrips);
  animKPI('rpPax',     totPax);
  animKPI('rpKm',      Math.round(totKm));
  animKPI('rpOcc',     avgOcc, '%');
  animKPI('rpAlerts',  totAlerts);

  const revEl = document.getElementById('rpRevenue');
  if (revEl) revEl.textContent = `S/ ${totRev.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
}

function animKPI(id, target, suffix = '') {
  const el = document.getElementById(id);
  if (!el) return;
  const dur = 900, t0 = performance.now();
  function step(ts) {
    const p = Math.min((ts - t0) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * e) + suffix;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}


/* ============================================================
   5. GRÁFICOS
   ============================================================ */
const COLORS = [
  'rgba(0,200,255,0.8)', 'rgba(0,255,148,0.8)', 'rgba(255,184,0,0.8)',
  'rgba(255,68,68,0.8)',  'rgba(138,80,255,0.8)',
];
const GRID_COLOR = 'rgba(255,255,255,0.05)';
const TEXT_COLOR = '#8892a4';

let chartRevCompany  = null;
let chartTripsTrend  = null;
let chartPassWeekday = null;
let chartPayment     = null;
let chartSpeedAlerts = null;

function initCharts() {
  Chart.defaults.color       = TEXT_COLOR;
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size   = 11;

  /* 1. Recaudación por empresa (barras horizontales) */
  const ctxRev = document.getElementById('chartRevCompany')?.getContext('2d');
  if (ctxRev) {
    chartRevCompany = new Chart(ctxRev, {
      type: 'bar',
      data: {
        labels: COMPANIES.map(c => c.length > 20 ? c.slice(0, 18) + '…' : c),
        datasets: [{
          label: 'Recaudación (S/)',
          data: companyData.map(c => c.revenue),
          backgroundColor: COLORS,
          borderRadius: 6,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: GRID_COLOR }, ticks: { callback: v => `S/ ${v.toLocaleString()}` } },
          y: { grid: { color: GRID_COLOR } },
        },
      },
    });
  }

  /* 2. Tendencia de viajes (línea) */
  const dailyTrips = buildDailyTrips(30);
  const ctxTrend   = document.getElementById('chartTripsTrend')?.getContext('2d');
  if (ctxTrend) {
    chartTripsTrend = new Chart(ctxTrend, {
      type: 'line',
      data: {
        labels: dailyTrips.map(d => d.label),
        datasets: [{
          label: 'Viajes/día',
          data:   dailyTrips.map(d => d.value),
          borderColor: 'rgba(0,200,255,0.9)',
          backgroundColor: 'rgba(0,200,255,0.08)',
          tension: 0.4,
          fill: true,
          pointRadius: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: GRID_COLOR }, ticks: { maxTicksLimit: 10 } },
          y: { grid: { color: GRID_COLOR }, beginAtZero: true },
        },
      },
    });
  }

  /* 3. Pasajeros por día de semana */
  const wdData = buildWeekdayData();
  const ctxWd  = document.getElementById('chartPassWeekday')?.getContext('2d');
  if (ctxWd) {
    chartPassWeekday = new Chart(ctxWd, {
      type: 'bar',
      data: {
        labels: wdData.map(d => d.label),
        datasets: [{
          label: 'Pasajeros',
          data:   wdData.map(d => d.value),
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
          x: { grid: { color: GRID_COLOR } },
          y: { grid: { color: GRID_COLOR }, beginAtZero: true },
        },
      },
    });
  }

  /* 4. Métodos de pago (donut) */
  const pmData = buildPaymentData();
  const ctxPm  = document.getElementById('chartPayment')?.getContext('2d');
  if (ctxPm) {
    chartPayment = new Chart(ctxPm, {
      type: 'doughnut',
      data: {
        labels: pmData.map(p => p.label),
        datasets: [{
          data:            pmData.map(p => p.value),
          backgroundColor: pmData.map(p => p.color),
          borderColor: '#0d1224',
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12, font: { size: 11 } } },
        },
        cutout: '65%',
      },
    });
  }

  /* 5. Alertas de velocidad por empresa (barras) */
  const ctxAlrt = document.getElementById('chartSpeedAlerts')?.getContext('2d');
  if (ctxAlrt) {
    chartSpeedAlerts = new Chart(ctxAlrt, {
      type: 'bar',
      data: {
        labels: COMPANIES.map(c => c.split(' ').slice(-1)[0]),
        datasets: [{
          label: 'Alertas',
          data: companyData.map(c => c.speedAlerts),
          backgroundColor: 'rgba(255,68,68,0.7)',
          borderColor: 'rgba(255,68,68,0.9)',
          borderWidth: 1,
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: GRID_COLOR } },
          y: { grid: { color: GRID_COLOR }, beginAtZero: true, ticks: { stepSize: 1 } },
        },
      },
    });
  }
}

/** Actualiza los gráficos al cambiar período */
function refreshCharts(days) {
  /* Recaudación por empresa */
  if (chartRevCompany) {
    chartRevCompany.data.datasets[0].data = companyData.map(c => c.revenue);
    chartRevCompany.update();
  }

  /* Tendencia */
  if (chartTripsTrend) {
    const daily = buildDailyTrips(Math.min(days, 30));
    chartTripsTrend.data.labels              = daily.map(d => d.label);
    chartTripsTrend.data.datasets[0].data    = daily.map(d => d.value);
    chartTripsTrend.update();
  }

  /* Alertas */
  if (chartSpeedAlerts) {
    chartSpeedAlerts.data.datasets[0].data = companyData.map(c => c.speedAlerts);
    chartSpeedAlerts.update();
  }
}


/* ============================================================
   6. RANKING DE CONDUCTORES
   ============================================================ */
function renderTopDrivers() {
  const list = document.getElementById('topDriversList');
  if (!list) return;

  /* Generar ranking ficticio para el período */
  const drivers = DRIVERS_NAMES.map((name, i) => ({
    name,
    company:  COMPANIES[i % COMPANIES.length],
    trips:    Math.floor(Math.random() * 80) + 40,
    revenue:  0,
    initials: name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
  }));

  drivers.forEach(d => { d.revenue = d.trips * (Math.floor(Math.random() * 10) + 8) * 7; });
  drivers.sort((a, b) => b.revenue - a.revenue);

  const posClasses = ['pos1', 'pos2', 'pos3', '', '', '', '', ''];

  list.innerHTML = drivers.slice(0, 5).map((d, i) => `
    <div class="rp-rank-item">
      <span class="rp-rank-pos ${posClasses[i]}">${i + 1}</span>
      <div class="rp-rank-avatar">${d.initials}</div>
      <div class="rp-rank-info">
        <div class="rp-rank-name">${d.name}</div>
        <div class="rp-rank-sub">${d.company}</div>
      </div>
      <div class="rp-rank-stats">
        <div class="rp-rank-stat">
          <span class="rp-rank-stat-val">${d.trips}</span>
          <span class="rp-rank-stat-lbl">Viajes</span>
        </div>
        <div class="rp-rank-stat">
          <span class="rp-rank-stat-val gold">S/ ${d.revenue.toLocaleString()}</span>
          <span class="rp-rank-stat-lbl">Recaud.</span>
        </div>
      </div>
    </div>
  `).join('');
}


/* ============================================================
   7. TABLA RESUMEN POR EMPRESA
   ============================================================ */
function renderCompanyTable() {
  const tbody = document.getElementById('companyBody');
  if (!tbody) return;

  tbody.innerHTML = companyData.map(c => `
    <tr>
      <td><strong>${c.company}</strong></td>
      <td style="text-align:center">${c.fleet}</td>
      <td style="text-align:center;font-weight:600">${c.trips.toLocaleString()}</td>
      <td style="text-align:center">${c.passengers.toLocaleString()}</td>
      <td style="color:var(--gold);font-weight:600">S/ ${c.revenue.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
      <td style="color:var(--text-sub)">${Math.round(c.km).toLocaleString()} km</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;height:6px;background:var(--dark-2);border-radius:3px;overflow:hidden">
            <div style="width:${c.occ}%;height:100%;background:var(--primary);border-radius:3px"></div>
          </div>
          <span style="font-weight:600;min-width:32px">${c.occ}%</span>
        </div>
      </td>
      <td style="color:${c.speedAlerts > 5 ? 'var(--danger)' : 'var(--text-sub)'};font-weight:${c.speedAlerts > 5 ? '700' : '400'}">
        ${c.speedAlerts}
        ${c.speedAlerts > 5 ? '<i class="fas fa-exclamation-triangle" style="font-size:11px"></i>' : ''}
      </td>
    </tr>
  `).join('');
}


/* ============================================================
   8. EXPORTAR
   ============================================================ */
function exportReport(type) {
  if (type === 'csv') {
    const headers = ['Empresa', 'Flota', 'Viajes', 'Pasajeros', 'Recaudación', 'Km recorridos', 'Ocupación', 'Alertas vel.'];
    const rows    = companyData.map(c => [
      c.company, c.fleet, c.trips, c.passengers,
      `S/ ${c.revenue.toFixed(2)}`, `${Math.round(c.km)} km`,
      `${c.occ}%`, c.speedAlerts,
    ]);
    const csv   = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob  = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href      = url;
    a.download  = `reporte_${currentPeriod}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    window.print();
  }
}

window.exportReport = exportReport;


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
  updateKPIs();
  renderCompanyTable();
  renderTopDrivers();
  initCharts();
})();
