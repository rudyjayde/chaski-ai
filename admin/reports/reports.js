/* ============================================================
   reports.js — Lógica de la página de Reportes
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
   2. ESTADO
   ============================================================ */
const PERIOD_DAYS = { month: 30, quarter: 90, year: 365 };
let currentPeriod = 'month';
let companyData   = [];

function getPeriodDates(period) {
  const today = new Date().toISOString().split('T')[0];
  const days  = PERIOD_DAYS[period] || 30;
  const from  = new Date(Date.now() - (days - 1) * 86400000).toISOString().split('T')[0];
  return { from, to: today };
}


/* ============================================================
   3. SELECTOR DE PERÍODO
   ============================================================ */
async function setRpPeriod(period, btn) {
  currentPeriod = period;
  document.querySelectorAll('.rp-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  await loadAllData();
}

window.setRpPeriod = setRpPeriod;


/* ============================================================
   4. CARGA DE DATOS DESDE API
   ============================================================ */
async function loadAllData() {
  const { from, to } = getPeriodDates(currentPeriod);

  let rawCompany = [], rawDaily = [], rawDrivers = [], rawPayment = {}, rawWeekday = [];

  try {
    const [companyRes, dailyRes, driversRes, paymentRes, weekdayRes] = await Promise.all([
      authFetch(`/api/reports/revenue?from=${from}&to=${to}`),
      authFetch(`/api/reports/daily?from=${from}&to=${to}`),
      authFetch(`/api/reports/drivers?date=${to}`),
      authFetch(`/api/reports/payment?from=${from}&to=${to}`),
      authFetch(`/api/reports/weekday?from=${from}&to=${to}`),
    ]);

    rawCompany = await companyRes.json();
    rawDaily   = await dailyRes.json();
    rawDrivers = await driversRes.json();
    rawPayment = await paymentRes.json();
    rawWeekday = await weekdayRes.json();
  } catch (err) {
    console.error('[Reports] Error al cargar datos:', err.message);
  }

  /* Normalizar datos de empresa */
  companyData = Array.isArray(rawCompany) ? rawCompany.map(c => {
    const trips      = parseInt(c.trips)      || 0;
    const passengers = parseInt(c.passengers) || 0;
    const revenue    = parseFloat(c.revenue)  || 0;
    const km         = trips * 98.5;
    const occ        = trips > 0 ? Math.round((passengers / (trips * 22)) * 100) : 0;
    return { company: c.company || '—', trips, passengers, revenue, km, occ, speedAlerts: 0 };
  }) : [];

  updateKPIs();
  renderCompanyTable();
  renderTopDrivers(Array.isArray(rawDrivers) ? rawDrivers : []);
  refreshCharts(Array.isArray(rawDaily) ? rawDaily : [], rawPayment, Array.isArray(rawWeekday) ? rawWeekday : []);
}


/* ============================================================
   5. KPI EJECUTIVOS
   ============================================================ */
function updateKPIs() {
  const totTrips = companyData.reduce((s, c) => s + c.trips,      0);
  const totPax   = companyData.reduce((s, c) => s + c.passengers, 0);
  const totRev   = companyData.reduce((s, c) => s + c.revenue,    0);
  const totKm    = companyData.reduce((s, c) => s + c.km,         0);
  const avgOcc   = companyData.length
    ? Math.round(companyData.reduce((s, c) => s + c.occ, 0) / companyData.length)
    : 0;

  animKPI('rpTrips',  totTrips);
  animKPI('rpPax',    totPax);
  animKPI('rpKm',     Math.round(totKm));
  animKPI('rpOcc',    avgOcc, '%');
  animKPI('rpAlerts', 0);

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
   6. GRÁFICOS
   ============================================================ */
const COLORS      = ['rgba(0,200,255,0.8)', 'rgba(0,255,148,0.8)', 'rgba(255,184,0,0.8)', 'rgba(255,68,68,0.8)', 'rgba(138,80,255,0.8)'];
const GRID_COLOR  = 'rgba(255,255,255,0.05)';
const TEXT_COLOR  = '#8892a4';

let chartRevCompany  = null;
let chartTripsTrend  = null;
let chartPassWeekday = null;
let chartPayment     = null;
let chartSpeedAlerts = null;
let chartsInitialized = false;

function initCharts(rawDaily, rawPayment, rawWeekday) {
  Chart.defaults.color       = TEXT_COLOR;
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size   = 11;

  /* 1. Recaudación por empresa (barras horizontales) */
  const ctxRev = document.getElementById('chartRevCompany')?.getContext('2d');
  if (ctxRev) {
    chartRevCompany = new Chart(ctxRev, {
      type: 'bar',
      data: {
        labels: companyData.map(c => c.company.length > 20 ? c.company.slice(0, 18) + '…' : c.company),
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

  /* 2. Tendencia de viajes por día */
  const ctxTrend = document.getElementById('chartTripsTrend')?.getContext('2d');
  if (ctxTrend) {
    chartTripsTrend = new Chart(ctxTrend, {
      type: 'line',
      data: {
        labels: rawDaily.map(d => new Date(d.date).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })),
        datasets: [{
          label: 'Viajes/día',
          data:   rawDaily.map(d => parseInt(d.trips) || 0),
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
  const ctxWd = document.getElementById('chartPassWeekday')?.getContext('2d');
  if (ctxWd) {
    chartPassWeekday = new Chart(ctxWd, {
      type: 'bar',
      data: {
        labels: rawWeekday.map(d => d.label),
        datasets: [{
          label: 'Pasajeros',
          data:   rawWeekday.map(d => d.passengers || 0),
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
  const cashPax    = parseInt(rawPayment.cash_passengers)    || 0;
  const digitalPax = parseInt(rawPayment.digital_passengers) || 0;
  const ctxPm = document.getElementById('chartPayment')?.getContext('2d');
  if (ctxPm) {
    chartPayment = new Chart(ctxPm, {
      type: 'doughnut',
      data: {
        labels: ['Efectivo', 'Digital (Yape/Plin)'],
        datasets: [{
          data:            [cashPax, digitalPax],
          backgroundColor: ['rgba(0,200,255,0.8)', 'rgba(0,255,148,0.8)'],
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

  /* 5. Alertas de velocidad por empresa (placeholder — sin datos granulares) */
  const ctxAlrt = document.getElementById('chartSpeedAlerts')?.getContext('2d');
  if (ctxAlrt) {
    chartSpeedAlerts = new Chart(ctxAlrt, {
      type: 'bar',
      data: {
        labels: companyData.map(c => c.company.split(' ').slice(-1)[0]),
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

  chartsInitialized = true;
}

function refreshCharts(rawDaily, rawPayment, rawWeekday) {
  if (!chartsInitialized) {
    initCharts(rawDaily, rawPayment, rawWeekday);
    return;
  }

  if (chartRevCompany) {
    chartRevCompany.data.labels                = companyData.map(c => c.company.length > 20 ? c.company.slice(0, 18) + '…' : c.company);
    chartRevCompany.data.datasets[0].data      = companyData.map(c => c.revenue);
    chartRevCompany.update();
  }

  if (chartTripsTrend) {
    chartTripsTrend.data.labels             = rawDaily.map(d => new Date(d.date).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }));
    chartTripsTrend.data.datasets[0].data   = rawDaily.map(d => parseInt(d.trips) || 0);
    chartTripsTrend.update();
  }

  if (chartPassWeekday) {
    chartPassWeekday.data.datasets[0].data = rawWeekday.map(d => d.passengers || 0);
    chartPassWeekday.update();
  }

  if (chartPayment) {
    const cashPax    = parseInt(rawPayment.cash_passengers)    || 0;
    const digitalPax = parseInt(rawPayment.digital_passengers) || 0;
    chartPayment.data.datasets[0].data = [cashPax, digitalPax];
    chartPayment.update();
  }

  if (chartSpeedAlerts) {
    chartSpeedAlerts.data.labels             = companyData.map(c => c.company.split(' ').slice(-1)[0]);
    chartSpeedAlerts.data.datasets[0].data   = companyData.map(c => c.speedAlerts);
    chartSpeedAlerts.update();
  }
}


/* ============================================================
   7. RANKING DE CONDUCTORES
   ============================================================ */
function renderTopDrivers(drivers) {
  const list = document.getElementById('topDriversList');
  if (!list) return;

  if (drivers.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;font-size:13px">Sin datos para el período</p>';
    return;
  }

  const sorted = [...drivers].sort((a, b) => parseFloat(b.revenue) - parseFloat(a.revenue)).slice(0, 5);
  const posClasses = ['pos1', 'pos2', 'pos3', '', ''];

  list.innerHTML = sorted.map((d, i) => {
    const initials = (d.driver_name || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const revenue  = parseFloat(d.revenue) || 0;
    const trips    = parseInt(d.trips) || 0;
    return `
      <div class="rp-rank-item">
        <span class="rp-rank-pos ${posClasses[i]}">${i + 1}</span>
        <div class="rp-rank-avatar">${initials}</div>
        <div class="rp-rank-info">
          <div class="rp-rank-name">${d.driver_name || '—'}</div>
          <div class="rp-rank-sub">${d.association_code || '—'}</div>
        </div>
        <div class="rp-rank-stats">
          <div class="rp-rank-stat">
            <span class="rp-rank-stat-val">${trips}</span>
            <span class="rp-rank-stat-lbl">Viajes</span>
          </div>
          <div class="rp-rank-stat">
            <span class="rp-rank-stat-val gold">S/ ${revenue.toLocaleString('es-PE', { minimumFractionDigits: 0 })}</span>
            <span class="rp-rank-stat-lbl">Recaud.</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}


/* ============================================================
   8. TABLA RESUMEN POR EMPRESA
   ============================================================ */
function renderCompanyTable() {
  const tbody = document.getElementById('companyBody');
  if (!tbody) return;

  if (companyData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted)">Sin datos para el período seleccionado</td></tr>`;
    return;
  }

  tbody.innerHTML = companyData.map(c => `
    <tr>
      <td><strong>${c.company}</strong></td>
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
        ${c.speedAlerts > 5 ? '<i data-lucide="alert-triangle"></i>' : ''}
      </td>
    </tr>
  `).join('');
}


/* ============================================================
   9. EXPORTAR
   ============================================================ */
function exportReport(type) {
  if (type === 'csv') {
    const headers = ['Empresa', 'Viajes', 'Pasajeros', 'Recaudación', 'Km recorridos', 'Ocupación', 'Alertas vel.'];
    const rows    = companyData.map(c => [
      c.company, c.trips, c.passengers,
      `S/ ${c.revenue.toFixed(2)}`, `${Math.round(c.km)} km`,
      `${c.occ}%`, c.speedAlerts,
    ]);
    const csv  = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `reporte_${currentPeriod}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    window.print();
  }
}

window.exportReport = exportReport;


/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
(async function init() {
  await loadAllData();
})();
