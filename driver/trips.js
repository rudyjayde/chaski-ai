/* ============================================================
   driver/trips.js — Lógica de la página Mis Viajes
   Chaski AI v2.0
   ============================================================
   Contenido:
   1.  Autenticación y perfil
   2.  Datos demo de viajes del conductor
   3.  Selector de período
   4.  KPI del conductor
   5.  Historial de viajes
   ============================================================ */

'use strict';

/* ============================================================
   1. AUTENTICACIÓN
   ============================================================ */
const session = JSON.parse(localStorage.getItem('chaski_user') || 'null');
if (!session || session.role !== 'driver') {
  window.location.href = '../login.html';
}

const DRIVER_DATA = {
  'eloy.mamani':     { name: 'Eloy Mamani',     vehicle: '001', plate: 'PUN-001', company: 'Virgen de Fátima' },
  'jose.quispe':     { name: 'José Quispe',      vehicle: '002', plate: 'PUN-002', company: 'Surandino' },
  'abraham.morales': { name: 'Abraham Morales',  vehicle: '003', plate: 'PUN-003', company: 'San Francisco de Borja' },
  'juan.perez':      { name: 'Juan Pérez',       vehicle: '004', plate: 'PUN-004', company: 'Virgen de Fátima II' },
  'carlos.ticona':   { name: 'Carlos Ticona',    vehicle: '005', plate: 'PUN-005', company: 'San Miguel' },
};
const driver = DRIVER_DATA[session.username] || { name: session.name, vehicle: '001', plate: 'PUN-001', company: '—' };

const nameEl    = document.getElementById('sidebarDriverName');
const vehicleEl = document.getElementById('sidebarVehicle');
const companyEl = document.getElementById('sidebarCompany');
if (nameEl)    nameEl.textContent    = driver.name;
if (vehicleEl) vehicleEl.textContent = `Unidad ${driver.vehicle} · ${driver.plate}`;
if (companyEl) companyEl.textContent = driver.company;

function logout() {
  localStorage.removeItem('chaski_user');
  window.location.href = '../login.html';
}
window.logout = logout;


/* ============================================================
   RELOJ
   ============================================================ */
function updateClock() {
  const now  = new Date();
  const clockEl = document.getElementById('clockDisplay');
  const dateEl  = document.getElementById('dateDisplay');
  if (clockEl) clockEl.textContent = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  if (dateEl) {
    const d = now.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    dateEl.textContent = d.charAt(0).toUpperCase() + d.slice(1);
  }
}
setInterval(updateClock, 1000);
updateClock();

document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar')?.classList.toggle('open');
});


/* ============================================================
   2. DATOS DEMO DE VIAJES
   ============================================================ */
function generateMyTrips(days = 30) {
  const trips = [];
  const now   = new Date();

  for (let d = 0; d < days; d++) {
    const day   = new Date(now);
    day.setDate(now.getDate() - d);
    const count = (d === 0 ? 2 : Math.floor(Math.random() * 3) + 1);

    for (let i = 0; i < count; i++) {
      const hour     = Math.floor(Math.random() * 14) + 6;
      const pax      = Math.floor(Math.random() * 20) + 5;
      const revenue  = pax * 7.0;
      const duration = Math.floor(Math.random() * 30) + 70;

      const dep = new Date(day);
      dep.setHours(hour, Math.floor(Math.random() * 60), 0);

      const routes = ['Juli → Puno','Puno → Juli'];
      trips.push({
        id:        trips.length + 1,
        dep,
        route:     i % 2 === 0 ? 'Juli → Puno' : 'Puno → Juli',
        pax,
        revenue,
        duration,
        km:        98.5,
        cashRatio: 0.5 + Math.random() * 0.4,
        status:    d === 0 && i === 0 ? 'transit' : 'completed',
      });
    }
  }
  return trips.sort((a, b) => b.dep - a.dep);
}

const ALL_MY_TRIPS = generateMyTrips(90);
let currentDays = 7;


/* ============================================================
   3. SELECTOR DE PERÍODO
   ============================================================ */
function setDrPeriod(days, btn) {
  currentDays = days;
  document.querySelectorAll('.tr-period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const lbl = document.getElementById('periodLabel');
  if (lbl) lbl.textContent = days === 7 ? 'Últimos 7 días' : days === 30 ? 'Este mes' : 'Últimos 3 meses';

  renderMyTrips();
  updateKPIs();
}
window.setDrPeriod = setDrPeriod;


/* ============================================================
   4. KPI
   ============================================================ */
function updateKPIs() {
  const filtered = ALL_MY_TRIPS.filter(t => {
    const diffDays = (new Date() - t.dep) / (1000 * 60 * 60 * 24);
    return diffDays <= currentDays;
  });

  const total   = filtered.length;
  const pax     = filtered.reduce((s, t) => s + t.pax, 0);
  const km      = Math.round(filtered.reduce((s, t) => s + t.km, 0));
  const revenue = filtered.reduce((s, t) => s + t.revenue, 0);

  animKPI('kpiTotal', total);
  animKPI('kpiPax',   pax);
  animKPI('kpiKm',    km);

  const revEl = document.getElementById('kpiRev');
  if (revEl) revEl.textContent = `S/ ${revenue.toFixed(2)}`;
}

function animKPI(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const dur = 800, t0 = performance.now();
  (function step(ts) {
    const p = Math.min((ts - t0) / dur, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  })(performance.now());
}


/* ============================================================
   5. HISTORIAL DE VIAJES (PERÍODO)
   ============================================================ */
function renderMyTrips() {
  const list = document.getElementById('tripsList');
  if (!list) return;

  const filtered = ALL_MY_TRIPS.filter(t => {
    const diffDays = (new Date() - t.dep) / (1000 * 60 * 60 * 24);
    return diffDays <= currentDays;
  });

  if (filtered.length === 0) {
    list.innerHTML = `<div class="dt-empty"><i class="fas fa-route"></i><p>Sin viajes en este período</p></div>`;
    return;
  }

  list.innerHTML = filtered.map((t, i) => {
    const depStr = t.dep.toLocaleDateString('es-PE', { weekday:'short', day:'2-digit', month:'short' })
                 + ' · ' + t.dep.toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit' });
    const durStr = `${Math.floor(t.duration / 60)}h ${t.duration % 60}m`;
    const cashPct = Math.round(t.cashRatio * 100);
    return `
      <div class="dt-trip-card">
        <div class="dt-trip-num">${i + 1}</div>
        <div class="dt-trip-body">
          <div class="dt-trip-route">${t.route}</div>
          <div class="dt-trip-meta">
            <span><i class="fas fa-calendar-alt"></i>${depStr}</span>
            <span><i class="fas fa-clock"></i>${durStr}</span>
            <span><i class="fas fa-road"></i>${t.km} km</span>
          </div>
          <div class="dt-pay-mini">
            <span class="dpm cash"><img src="../img/soles.png" class="dpm-logo" alt=""> ${Math.round(t.pax * t.cashRatio)}</span>
            <span class="dpm yape"><img src="../img/yape.png" class="dpm-logo" alt=""> ${t.pax - Math.round(t.pax * t.cashRatio)}</span>
          </div>
        </div>
        <div class="dt-trip-stats">
          <div class="dt-stat">
            <span class="dt-stat-val">${t.pax}</span>
            <span class="dt-stat-lbl">Pasajeros</span>
          </div>
          <div class="dt-stat">
            <span class="dt-stat-val gold">S/${t.revenue.toFixed(0)}</span>
            <span class="dt-stat-lbl">Recaudado</span>
          </div>
        </div>
        <span class="status-badge ${t.status === 'transit' ? 'transit' : 'completed'}">
          <i class="fas ${t.status === 'transit' ? 'fa-truck-moving' : 'fa-check-circle'}"></i>
          ${t.status === 'transit' ? 'En ruta' : 'Completado'}
        </span>
      </div>`;
  }).join('');
}


/* ============================================================
   6. VISTA POR DÍA (VUELTAS)
   ============================================================ */
let currentView = 'period';
let selectedDay = new Date();

function setView(view, btn) {
  currentView = view;
  document.querySelectorAll('.tr-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const isPeriod = view === 'period';
  document.getElementById('viewPeriod').style.display   = isPeriod ? '' : 'none';
  document.getElementById('viewDay').style.display      = isPeriod ? 'none' : '';
  document.getElementById('periodBtns').style.display   = isPeriod ? '' : 'none';
  document.getElementById('dayPicker').style.display    = isPeriod ? 'none' : '';

  if (!isPeriod) {
    const input = document.getElementById('dayInput');
    if (input) {
      const iso = selectedDay.toISOString().slice(0,10);
      input.value = iso;
    }
    renderDayView();
  }
}
window.setView = setView;

function shiftDay(delta) {
  selectedDay = new Date(selectedDay);
  selectedDay.setDate(selectedDay.getDate() + delta);
  document.getElementById('dayInput').value = selectedDay.toISOString().slice(0,10);
  renderDayView();
}
window.shiftDay = shiftDay;

function renderDayView() {
  const input = document.getElementById('dayInput');
  if (input && input.value) {
    selectedDay = new Date(input.value + 'T12:00:00');
  }

  const yy = selectedDay.getFullYear();
  const mm = selectedDay.getMonth();
  const dd = selectedDay.getDate();

  /* Filtrar viajes de ese día */
  const dayTrips = ALL_MY_TRIPS.filter(t =>
    t.dep.getFullYear() === yy &&
    t.dep.getMonth()    === mm &&
    t.dep.getDate()     === dd
  ).sort((a,b) => a.dep - b.dep);

  /* Label del día */
  const dayFmt = selectedDay.toLocaleDateString('es-PE', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const capDay = dayFmt.charAt(0).toUpperCase() + dayFmt.slice(1);
  const labelEl = document.getElementById('dayLabel');
  if (labelEl) labelEl.textContent = capDay;

  if (dayTrips.length === 0) {
    document.getElementById('daySummaryCard').style.display = 'none';
    document.getElementById('dayTripsList').innerHTML = `
      <div class="dt-empty">
        <i class="fas fa-calendar-times"></i>
        <p>Sin viajes registrados para este día</p>
      </div>`;
    document.getElementById('vueltasBadge').textContent = '0 vueltas';
    return;
  }

  /* Calcular vueltas (par de ida+regreso = 1 vuelta) */
  const vueltas  = Math.floor(dayTrips.length / 2);
  const fraccion = dayTrips.length % 2 === 1 ? ' y media' : '';
  const totalPax     = dayTrips.reduce((s,t) => s+t.pax, 0);
  const totalRev     = dayTrips.reduce((s,t) => s+t.revenue, 0);
  const totalCash    = dayTrips.reduce((s,t) => s + Math.round(t.pax*t.cashRatio), 0);
  const totalYape    = dayTrips.reduce((s,t) => s + Math.round(t.pax*(1-t.cashRatio)*0.6), 0);
  const totalPlin    = dayTrips.reduce((s,t) => s + Math.round(t.pax*(1-t.cashRatio)*0.3), 0);
  const totalOther   = totalPax - totalCash - totalYape - totalPlin;

  /* Resumen */
  document.getElementById('daySummaryCard').style.display = '';
  document.getElementById('dsDayTitle').textContent  = capDay;
  document.getElementById('dsVueltas').textContent   = `${vueltas}${fraccion}`;
  document.getElementById('dsTrips').textContent     = dayTrips.length;
  document.getElementById('dsPax').textContent       = totalPax;
  document.getElementById('dsRevenue').textContent   = `S/ ${totalRev.toFixed(2)}`;
  document.getElementById('dsCash').textContent      = totalCash;
  document.getElementById('dsYape').textContent      = totalYape;
  document.getElementById('dsPlin').textContent      = totalPlin;
  document.getElementById('dsOther').textContent     = Math.max(0, totalOther);
  document.getElementById('vueltasBadge').textContent = `${vueltas}${fraccion} vuelta${vueltas !== 1 ? 's' : ''}`;

  /* Lista de vueltas */
  const dayList = document.getElementById('dayTripsList');
  let html = '';
  for (let i = 0; i < dayTrips.length; i += 2) {
    const ida     = dayTrips[i];
    const regreso = dayTrips[i + 1];
    const vueltaNum = Math.floor(i / 2) + 1;
    const isHalf    = !regreso;

    html += `<div class="vuelta-block">`;
    html += `<div class="vuelta-label">
      <span class="vuelta-num">${isHalf ? '½' : vueltaNum}ª Vuelta</span>
      ${isHalf ? '<span class="vuelta-half-badge">Solo ida</span>' : ''}
    </div>`;
    html += tripRowHtml(ida,   '↗ IDA');
    if (regreso) html += tripRowHtml(regreso, '↙ REGRESO');
    html += `</div>`;
  }
  dayList.innerHTML = html;
}
window.renderDayView = renderDayView;

function tripRowHtml(t, label) {
  const timeStr = t.dep.toLocaleTimeString('es-PE', {hour:'2-digit', minute:'2-digit'});
  const cashN   = Math.round(t.pax * t.cashRatio);
  const digN    = t.pax - cashN;
  return `
    <div class="dt-trip-card vuelta-trip">
      <div class="vuelta-dir-badge">${label}</div>
      <div class="dt-trip-body">
        <div class="dt-trip-route">${t.route}</div>
        <div class="dt-trip-meta">
          <span><i class="fas fa-clock"></i>${timeStr}</span>
          <span><i class="fas fa-road"></i>${t.km} km</span>
        </div>
        <div class="dt-pay-mini">
          <span class="dpm cash"><img src="../img/soles.png" class="dpm-logo" alt=""> ${cashN} efect.</span>
          <span class="dpm yape"><img src="../img/yape.png" class="dpm-logo" alt=""> ${digN} digital</span>
        </div>
      </div>
      <div class="dt-trip-stats">
        <div class="dt-stat"><span class="dt-stat-val">${t.pax}</span><span class="dt-stat-lbl">Pax</span></div>
        <div class="dt-stat"><span class="dt-stat-val gold">S/${t.revenue.toFixed(0)}</span><span class="dt-stat-lbl">Cobrado</span></div>
      </div>
    </div>`;
}


/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
(function init() {
  updateKPIs();
  renderMyTrips();
})();
