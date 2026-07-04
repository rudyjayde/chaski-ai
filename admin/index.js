/* ============================================================
   admin/index.js — Dashboard del Panel Administrador
   Chaski AI v2.0 — Datos reales desde API REST
   ============================================================ */

'use strict';


/* ============================================================
   3. KPI CARDS — Datos reales desde /api/reports/summary
   ============================================================ */
(function initKPIs() {

  function animateKPI(el, target, prefix = '') {
    if (!el) return;
    const start = performance.now();
    const duration = 1600;
    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = prefix + Math.round(eased * target).toLocaleString('es-PE');
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const [summaryRes, tripsSumRes, vehiclesRes, driversRes] = await Promise.all([
        authFetch('/api/reports/summary'),
        authFetch('/api/trips/today/summary'),
        authFetch('/api/vehicles'),
        authFetch('/api/drivers'),
      ]);

      const summary    = await summaryRes.json();
      const tripsSum   = await tripsSumRes.json();
      const vData      = await vehiclesRes.json();
      const dData      = await driversRes.json();

      const vehicles       = Array.isArray(vData.vehicles) ? vData.vehicles : [];
      const drivers        = Array.isArray(dData.drivers)  ? dData.drivers  : [];
      const activeVehicles = vehicles.filter(v => v.active).length;
      const activeDrivers  = drivers.filter(d => d.active !== false).length;

      animateKPI(document.getElementById('kpiActive'),     activeVehicles);
      animateKPI(document.getElementById('kpiOperating'),  parseInt(tripsSum.active)        || 0);
      animateKPI(document.getElementById('kpiTrips'),      parseInt(summary.trips)          || 0);
      animateKPI(document.getElementById('kpiPassengers'), parseInt(summary.passengers)     || 0);
      animateKPI(document.getElementById('kpiDrivers'),    activeDrivers);
      animateKPI(document.getElementById('kpiRevenue'),    Math.round(parseFloat(summary.revenue) || 0), 'S/. ');
    } catch (err) {
      console.error('[KPI]', err.message);
    }
  });

})();


/* ============================================================
   4. GRÁFICO DE RECAUDACIÓN POR EMPRESA (Chart.js)
   ============================================================ */
(function initRevenueChart() {

  const COLORS_BG = [
    'rgba(0,200,255,0.7)', 'rgba(0,200,255,0.55)', 'rgba(0,200,255,0.4)',
    'rgba(255,184,0,0.6)', 'rgba(255,184,0,0.45)',
  ];

  async function fetchRevenue(period) {
    const today = new Date().toISOString().split('T')[0];
    let from = today;
    if (period === 'week') {
      const d = new Date(); d.setDate(d.getDate() - 6);
      from = d.toISOString().split('T')[0];
    } else if (period === 'month') {
      const d = new Date(); d.setDate(d.getDate() - 29);
      from = d.toISOString().split('T')[0];
    }
    const res = await authFetch(`/api/reports/revenue?from=${from}&to=${today}`);
    return res.json();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const canvas = document.getElementById('chartRevenue');
    if (!canvas || typeof Chart === 'undefined') return;

    let data = [];
    try { data = await fetchRevenue('today'); } catch (e) { console.error('[Revenue chart]', e); }

    const bg = data.map((_, i) => COLORS_BG[i % COLORS_BG.length]);
    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.map(c => c.company),
        datasets: [{
          label: 'Recaudación (S/.)',
          data: data.map(c => parseFloat(c.revenue) || 0),
          backgroundColor: bg,
          borderColor: bg.map(c => c.replace(/[\d.]+\)$/, '1)')),
          borderWidth: 1,
          borderRadius: 5,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` S/. ${ctx.parsed.y.toLocaleString('es-PE')}` } },
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: 'rgba(122,155,196,0.8)', font: { size: 11 } } },
          y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: 'rgba(122,155,196,0.8)', font: { size: 11 }, callback: v => 'S/. ' + v.toLocaleString('es-PE') } },
        },
      },
    });

    const filterEl = document.getElementById('revenueFilter');
    if (filterEl) {
      filterEl.addEventListener('change', async () => {
        try {
          const newData = await fetchRevenue(filterEl.value);
          const newBg   = newData.map((_, i) => COLORS_BG[i % COLORS_BG.length]);
          chart.data.labels = newData.map(c => c.company);
          chart.data.datasets[0].data            = newData.map(c => parseFloat(c.revenue) || 0);
          chart.data.datasets[0].backgroundColor = newBg;
          chart.data.datasets[0].borderColor     = newBg.map(c => c.replace(/[\d.]+\)$/, '1)'));
          chart.update();
        } catch (e) { console.error(e); }
      });
    }
  });

})();


/* ============================================================
   5. GRÁFICO DE ESTADO DE FLOTA (Chart.js — donut)
   ============================================================ */
(function initFleetChart() {

  document.addEventListener('DOMContentLoaded', async () => {
    const canvas = document.getElementById('chartFleet');
    if (!canvas || typeof Chart === 'undefined') return;

    let vehicles = [];
    try {
      const res = await authFetch('/api/vehicles');
      const d   = await res.json();
      vehicles  = Array.isArray(d.vehicles) ? d.vehicles : [];
    } catch (e) { console.error('[Fleet chart]', e); }

    const now = Date.now();
    const TWO_HOURS = 2 * 3600 * 1000;
    const inRoute   = vehicles.filter(v => v.active && v.last_gps_ping && (now - new Date(v.last_gps_ping)) < TWO_HOURS).length;
    const available = vehicles.filter(v => v.active && !(v.last_gps_ping && (now - new Date(v.last_gps_ping)) < TWO_HOURS)).length;
    const inactive  = vehicles.filter(v => !v.active && v.status !== 'maintenance').length;
    const maintenance = vehicles.filter(v => v.status === 'maintenance').length;

    const FLEET_DATA = {
      labels: ['En ruta', 'Disponible', 'Inactivo', 'Mantenimiento'],
      values: [inRoute, available, inactive, maintenance],
      colors: [
        'rgba(0,200,255,0.85)',
        'rgba(170,136,255,0.75)',
        'rgba(122,155,196,0.4)',
        'rgba(255,68,68,0.6)',
      ],
    };

    new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: FLEET_DATA.labels,
        datasets: [{
          data:            FLEET_DATA.values,
          backgroundColor: FLEET_DATA.colors,
          borderColor:     'rgba(10,16,40,0.8)',
          borderWidth:     2,
          hoverOffset:     6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} unidades` } },
        },
      },
    });

    const legendEl = document.getElementById('fleetLegend');
    if (legendEl) {
      FLEET_DATA.labels.forEach((label, i) => {
        const item = document.createElement('div');
        item.className = 'fl-item';
        item.innerHTML = `
          <span class="fl-dot" style="background:${FLEET_DATA.colors[i]}"></span>
          <span>${label}: <strong style="color:#fff">${FLEET_DATA.values[i]}</strong></span>
        `;
        legendEl.appendChild(item);
      });
    }
  });

})();


/* ============================================================
   6. MAPA GPS (Leaflet.js) — datos reales desde /api/gps/live
   ============================================================ */
(function initGPSMap() {

  const API_BASE = '';

  const ROUTE_COORDS = [
    [-16.2060, -69.4600], [-16.1500, -69.5200], [-16.0800, -69.5800],
    [-16.0100, -69.6400], [-15.9200, -69.8500], [-15.8400, -70.0200],
    [-15.8028, -70.0219],
  ];

  let map     = null;
  let markers = {};

  function makeVehicleIcon(code, speed) {
    const color = speed > 5 ? '#00C8FF' : speed > 0 ? '#FFB800' : '#7B8FAA';
    return L.divIcon({
      className: '',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      html: `<div style="width:30px;height:30px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.5);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#050818;box-shadow:0 0 10px ${color};">${code}</div>`,
    });
  }

  function makeEndIcon(label) {
    return L.divIcon({
      className: '',
      iconSize: [50, 22],
      html: `<div style="background:rgba(0,0,20,0.85);border:1px solid rgba(0,200,255,0.4);color:#00C8FF;font-size:9px;font-weight:700;letter-spacing:0.1em;padding:3px 6px;border-radius:4px;white-space:nowrap;">${label}</div>`,
    });
  }

  function formatTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  }

  async function loadVehicles() {
    try {
      const res  = await authFetch(`${API_BASE}/api/gps/live`);
      const data = await res.json();
      if (!data.ok) return;

      const withGPS = data.vehicles.filter(v => v.lat && v.lon);
      withGPS.forEach(v => {
        const latlng = [v.lat, v.lon];
        const icon   = makeVehicleIcon(v.code, v.speed || 0);
        const popup  = `<div style="font-family:Inter,sans-serif;font-size:12px;min-width:150px">
          <strong style="color:#00C8FF">Unidad ${v.code}</strong><br>
          <span>Placa: ${v.plate}</span><br>
          <span>Conductor: ${v.driver}</span><br>
          <span>Velocidad: ${v.speed || 0} km/h</span><br>
          <span>Última señal: ${formatTime(v.timestamp)}</span>
        </div>`;
        if (markers[v.vehicle_id]) {
          markers[v.vehicle_id].setLatLng(latlng).setIcon(icon).setPopupContent(popup);
        } else {
          markers[v.vehicle_id] = L.marker(latlng, { icon }).bindPopup(popup).addTo(map);
        }
      });

      const gpsCountEl = document.getElementById('gpsActiveCount');
      if (gpsCountEl) gpsCountEl.textContent = withGPS.length;
    } catch (err) {
      console.warn('[GPS Map] No se pudo cargar /api/gps/live:', err.message);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const mapEl = document.getElementById('gpsMap');
    if (!mapEl || typeof L === 'undefined') return;

    map = L.map('gpsMap', { zoomControl: true, attributionControl: false }).setView([-15.97, -69.75], 10);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(map);
    L.polyline(ROUTE_COORDS, { color: 'rgba(0,200,255,0.6)', weight: 3, dashArray: '6,4' }).addTo(map);
    L.marker(ROUTE_COORDS[0], { icon: makeEndIcon('JULI') }).addTo(map);
    L.marker(ROUTE_COORDS[ROUTE_COORDS.length - 1], { icon: makeEndIcon('PUNO') }).addTo(map);

    loadVehicles();
    setInterval(loadVehicles, 10000);
  });

  window.filterRoute = function(type, btn) {
    document.querySelectorAll('.dc-btn[data-route]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  };

})();


/* ── Campana compartida (arrivals + driver alerts) ────────── */
window._bellArrivals = 0;
window._bellDriver   = 0;
function _updateBell() {
  const el = document.getElementById('bellCount');
  if (!el) return;
  const total = window._bellArrivals + window._bellDriver;
  el.textContent    = total || 0;
  el.style.display  = total > 0 ? '' : 'none';
}

/* ============================================================
   7a. LLEGADAS DE CONDUCTORES — /api/arrivals
   ============================================================ */
(function initArrivals() {

  async function loadArrivals() {
    try {
      const res  = await authFetch('/api/arrivals');
      if (!res.ok) return;
      const data = await res.json();

      const list    = document.getElementById('arrivalsList');
      const countEl = document.getElementById('arrivalsCount');
      const bellEl  = document.getElementById('bellCount');

      if (countEl) {
        countEl.textContent   = data.unseen || 0;
        countEl.style.display = data.unseen > 0 ? 'inline-flex' : 'none';
      }
      window._bellArrivals = data.unseen || 0;
      _updateBell();

      if (!list) return;

      if (!data.arrivals || data.arrivals.length === 0) {
        list.innerHTML = '<p style="text-align:center;color:rgba(255,255,255,.3);padding:16px;font-size:12px">Sin llegadas en las últimas 24 h</p>';
        return;
      }

      const routeLabel = r => r === 'juli-puno' ? 'Juli → Puno' : 'Puno → Juli';

      list.innerHTML = data.arrivals.map(a => {
        const time    = new Date(a.arrived_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
        const isNew   = !a.seen_by_admin;
        return `
          <div class="alert-item" style="${isNew ? 'border-left:3px solid #10B981;background:rgba(16,185,129,.05);' : 'opacity:.7'}">
            <div class="alert-icon" style="background:rgba(16,185,129,.15);color:#10B981;flex-shrink:0">
              <i data-lucide="map-pin" style="width:14px;height:14px"></i>
            </div>
            <div class="alert-body">
              <strong>${a.driver_name || a.username} llegó a ${a.arrived_city}</strong>
              <span>${routeLabel(a.route)} · ${time}${isNew ? ' · <span style="color:#10B981;font-weight:700">NUEVO</span>' : ''}</span>
            </div>
          </div>`;
      }).join('');

      if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) { console.error('[Arrivals]', e); }
  }

  window.markArrivalsRead = async function () {
    try {
      await authFetch('/api/arrivals/seen-all', { method: 'PUT' });
      const countEl = document.getElementById('arrivalsCount');
      if (countEl) { countEl.textContent = '0'; countEl.style.display = 'none'; }
      await loadArrivals();
    } catch (e) { console.error('[Arrivals markRead]', e); }
  };

  document.addEventListener('DOMContentLoaded', () => {
    loadArrivals();
    setInterval(loadArrivals, 30000);
  });

})();


/* ============================================================
   7b. ALERTAS SOS / INCIDENTES DE CONDUCTORES
   ============================================================ */
(function initDriverAlerts() {

  function _esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  async function loadDriverAlerts() {
    try {
      const res = await authFetch('/api/communications/driver-alerts');
      if (!res.ok) return;
      const data = await res.json();

      window._bellDriver = data.pending || 0;
      _updateBell();

      const cntEl = document.getElementById('driverAlertsCount');
      if (cntEl) {
        cntEl.textContent  = window._bellDriver;
        cntEl.style.display = window._bellDriver > 0 ? 'inline-flex' : 'none';
      }

      const list = document.getElementById('driverAlertsList');
      if (!list) return;

      if (!data.alerts || data.alerts.length === 0) {
        list.innerHTML = '<p style="text-align:center;color:rgba(255,255,255,.3);padding:16px;font-size:12px">Sin alertas registradas</p>';
        return;
      }

      list.innerHTML = data.alerts.map(a => {
        const isPending = a.status === 'pending';
        const isUrgent  = a.type === 'urgent';
        const color     = isUrgent ? '#FF6B6B' : '#FFB800';
        const icon      = isUrgent ? 'siren' : 'triangle-alert';
        const time      = new Date(a.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
        const name      = _esc(a.driver_name || a.username || '—');
        const bodyText  = a.body ? `<span style="font-size:11px;color:rgba(255,255,255,.4);display:block;margin-top:2px">${_esc(a.body)}</span>` : '';
        const badge     = isPending ? `<span style="color:${color};font-weight:700"> · PENDIENTE</span>` : '';
        const btn       = isPending
          ? `<button onclick="resolveDriverAlert('${a.id}')" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.5);border-radius:6px;padding:4px 9px;cursor:pointer;font-size:11px;white-space:nowrap;flex-shrink:0">Resolver</button>`
          : '';
        return `
          <div class="alert-item" style="${isPending ? `border-left:3px solid ${color};background:${color}11` : 'opacity:.55'}">
            <div class="alert-icon" style="background:${color}22;color:${color};flex-shrink:0">
              <i data-lucide="${icon}" style="width:14px;height:14px"></i>
            </div>
            <div class="alert-body" style="flex:1;min-width:0">
              <strong>${_esc(a.title)}</strong>
              <span>${name} · ${time}${badge}</span>
              ${bodyText}
            </div>
            ${btn}
          </div>`;
      }).join('');

      if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) { console.error('[DriverAlerts]', e); }
  }

  window.resolveDriverAlert = async function (id) {
    try {
      await authFetch(`/api/communications/driver-alerts/${id}/resolve`, { method: 'PUT' });
      await loadDriverAlerts();
    } catch (e) { console.error('[resolveDriverAlert]', e); }
  };

  window.resolveAllDriverAlerts = async function () {
    try {
      await authFetch('/api/communications/driver-alerts/resolve-all', { method: 'PUT' });
      await loadDriverAlerts();
    } catch (e) { console.error('[resolveAllDriverAlerts]', e); }
  };

  document.addEventListener('DOMContentLoaded', () => {
    loadDriverAlerts();
    setInterval(loadDriverAlerts, 20000);
  });

})();


/* ============================================================
   7b. ALERTAS OPERATIVAS — datos reales desde /api/reports/alerts
   ============================================================ */
(function initAlerts() {

  document.addEventListener('DOMContentLoaded', async () => {
    const list = document.getElementById('alertsList');
    if (!list) return;

    let alerts = [];
    try {
      const res = await authFetch('/api/reports/alerts?limit=10');
      alerts = await res.json();
      if (!Array.isArray(alerts)) alerts = [];
    } catch (e) { console.error('[Alerts]', e); }

    if (alerts.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px">Sin alertas de velocidad para hoy</p>';
    } else {
      alerts.forEach(a => {
        const item = document.createElement('div');
        item.className = 'alert-item speed';
        const time = new Date(a.occurred_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
        item.innerHTML = `
          <div class="alert-icon"><i data-lucide="gauge" style="width:14px;height:14px"></i></div>
          <div class="alert-body">
            <strong>Velocidad excesiva — ${a.association_code || a.driver_name || '—'}</strong>
            <span>${a.max_speed} km/h · ${a.driver_name || '—'} · ${a.plate || '—'}</span>
          </div>
          <span class="alert-time">${time}</span>
        `;
        list.appendChild(item);
      });
    }

    const alertCount = document.getElementById('alertCount');
    if (alertCount) alertCount.textContent = alerts.length;
  });

})();


/* ============================================================
   8. TABLA DE ÚLTIMOS VIAJES — datos reales desde /api/trips
   ============================================================ */
(function initTripsTable() {

  const STATUS_LABELS = {
    active:    { cls: 'status-active', icon: 'fa-circle',      label: 'En ruta' },
    completed: { cls: 'status-done',   icon: 'fa-check',       label: 'Completado' },
    alert:     { cls: 'status-alert',  icon: 'fa-exclamation', label: 'Alerta' },
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const tbody = document.getElementById('tripsBody');
    if (!tbody) return;

    let trips = [];
    try {
      const today = new Date().toISOString().split('T')[0];
      const res   = await authFetch(`/api/trips?date=${today}&limit=6`);
      trips       = await res.json();
      if (!Array.isArray(trips)) trips = [];
    } catch (e) { console.error('[Trips table]', e); }

    if (trips.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px">Sin viajes registrados hoy</td></tr>';
      return;
    }

    trips.forEach(trip => {
      const maxSpeed = parseFloat(trip.max_speed) || 0;
      const status   = trip.status === 'active' ? 'active' : maxSpeed > 90 ? 'alert' : 'completed';
      const s        = STATUS_LABELS[status];
      const dep      = trip.start_time
        ? new Date(trip.start_time).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
        : '—';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${trip.association_code || '—'}</strong></td>
        <td>${trip.driver_name || '—'}</td>
        <td>${trip.route_name || '—'}</td>
        <td>${dep}</td>
        <td>${trip.total_passengers || 0}</td>
        <td>
          <span class="status-badge ${s.cls}">
            <i class="fas ${s.icon}"></i> ${s.label}
          </span>
        </td>
      `;
      tbody.appendChild(tr);
    });
  });

})();


/* ============================================================
   9. BÚSQUEDA DE VEHÍCULOS — datos reales desde /api/vehicles
   ============================================================ */
(function initVehicleSearch() {

  let vehicles = [];

  authFetch('/api/vehicles')
    .then(r => r.json())
    .then(d => { vehicles = Array.isArray(d.vehicles) ? d.vehicles : []; })
    .catch(() => {});

  window.searchVehicle = function() {
    const query  = (document.getElementById('vehicleSearch')?.value || '').trim().toUpperCase();
    const result = document.getElementById('vehicleResult');
    if (!result) return;

    if (!query) { result.innerHTML = ''; return; }

    const normalize = s => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const q = normalize(query);
    const found = vehicles.find(v =>
      normalize(v.plate).includes(q) || normalize(v.code).includes(q)
    );

    if (!found) {
      result.innerHTML = `
        <div style="padding:12px;font-size:0.84rem;color:var(--text-muted);">
          <i data-lucide="search"></i> No se encontró ningún vehículo con "${query}"
        </div>`;
      return;
    }

    const statusMap = { active: 'Activo', inactive: 'Inactivo', maintenance: 'Mantenimiento' };
    result.innerHTML = `
      <div class="vr-card">
        <div class="vr-row"><span>Código</span><strong>${found.code || '—'}</strong></div>
        <div class="vr-row"><span>Placa</span><strong>${found.plate || '—'}</strong></div>
        <div class="vr-row"><span>Empresa</span><strong>${found.company || '—'}</strong></div>
        <div class="vr-row"><span>Tipo</span><strong>${[found.brand, found.model].filter(Boolean).join(' ') || '—'}</strong></div>
        <div class="vr-row"><span>Conductor</span><strong>${found.driver_name || '—'}</strong></div>
        <div class="vr-row"><span>Estado</span>
          <strong style="color:var(--primary)">${statusMap[found.status] || found.status || '—'}</strong>
        </div>
      </div>`;
  };

  document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('vehicleSearch');
    if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') window.searchVehicle(); });
  });

})();
