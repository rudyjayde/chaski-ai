/* ============================================================
   admin/index.js — Lógica del Panel Administrador (Dashboard)
   Chaski AI v2.0
   ============================================================
   Contenido:
   1.  Auth guard                 (verifica sesión)
   2.  Reloj en tiempo real
   3.  KPI Cards                  (datos demo con animación)
   4.  Gráfico de recaudación     (Chart.js — barras)
   5.  Gráfico de flota           (Chart.js — donut)
   6.  Mapa GPS                   (Leaflet.js)
   7.  Panel de alertas           (generadas dinámicamente)
   8.  Tabla de últimos viajes
   9.  Búsqueda de vehículos
   10. Sidebar toggle             (móvil)
   ============================================================ */

'use strict';

/* ============================================================
   1. AUTH GUARD
   ============================================================ */
(function checkAuth() {
  const user = JSON.parse(localStorage.getItem('chaski_user') || '{}');
  if (!user.username || user.role !== 'admin') {
    window.location.href = '../login.html';
  }
  const nameEl = document.getElementById('adminUserName');
  if (nameEl) nameEl.textContent = user.name || 'Administrador';
})();


/* ============================================================
   2. RELOJ EN TIEMPO REAL
   ============================================================ */
(function initClock() {
  function tick() {
    const now  = new Date();
    const time = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    const date = now.toLocaleDateString('es-PE', {
      weekday: 'long', day: 'numeric', month: 'long'
    });

    const clockEl = document.getElementById('adminClock');
    const dateEl  = document.getElementById('adminDate');
    if (clockEl) clockEl.textContent = time;
    if (dateEl)  dateEl.textContent  = date.charAt(0).toUpperCase() + date.slice(1);
  }
  tick();
  setInterval(tick, 1000);
})();


/* ============================================================
   3. KPI CARDS — Datos demo con contadores animados
   ============================================================ */
(function initKPIs() {

  const KPI_DATA = {
    kpiActive:     { value: 58,       suffix: '' },
    kpiOperating:  { value: 12,       suffix: '' },
    kpiTrips:      { value: 94,       suffix: '' },
    kpiPassengers: { value: 1128,     suffix: '' },
    kpiDrivers:    { value: 47,       suffix: '' },
    kpiRevenue:    { value: 7896,     suffix: '',   prefix: 'S/. ' },
  };

  /**
   * Anima el contenido de un elemento de 0 a `target`.
   * @param {HTMLElement} el
   * @param {number}      target
   * @param {string}      prefix
   */
  function animateKPI(el, target, prefix = '') {
    const start = performance.now();
    const duration = 1600;
    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = Math.round(eased * target);
      el.textContent = prefix + val.toLocaleString('es-PE');
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* Lanzar cuando el DOM esté listo */
  document.addEventListener('DOMContentLoaded', () => {
    Object.entries(KPI_DATA).forEach(([id, cfg]) => {
      const el = document.getElementById(id);
      if (el) animateKPI(el, cfg.value, cfg.prefix || '');
    });
  });

})();


/* ============================================================
   4. GRÁFICO DE RECAUDACIÓN POR EMPRESA (Chart.js)
   ============================================================ */
(function initRevenueChart() {

  const COMPANIES   = ['V. de Fátima', 'Surandino', 'S.F. Borja', 'V. de Fátima II', 'San Miguel'];
  const COLORS_BG   = [
    'rgba(0,200,255,0.7)',
    'rgba(0,200,255,0.55)',
    'rgba(0,200,255,0.4)',
    'rgba(255,184,0,0.6)',
    'rgba(255,184,0,0.45)',
  ];
  const COLORS_BD   = COLORS_BG.map(c => c.replace(/[\d.]+\)$/, '1)'));

  const DATA_TODAY  = [1820, 1340, 1680, 1560, 1496];
  const DATA_WEEK   = [10200, 8900, 11200, 9800, 8400];
  const DATA_MONTH  = [42000, 37000, 46000, 40000, 35000];

  const DATA_MAP    = { today: DATA_TODAY, week: DATA_WEEK, month: DATA_MONTH };

  document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('chartRevenue');
    if (!canvas || typeof Chart === 'undefined') return;

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: COMPANIES,
        datasets: [{
          label: 'Recaudación (S/.)',
          data: DATA_TODAY,
          backgroundColor: COLORS_BG,
          borderColor:     COLORS_BD,
          borderWidth: 1,
          borderRadius: 5,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` S/. ${ctx.parsed.y.toLocaleString('es-PE')}`,
            },
          },
        },
        scales: {
          x: {
            grid:  { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: 'rgba(122,155,196,0.8)', font: { size: 11 } },
          },
          y: {
            grid:  { color: 'rgba(255,255,255,0.06)' },
            ticks: {
              color: 'rgba(122,155,196,0.8)',
              font: { size: 11 },
              callback: v => 'S/. ' + v.toLocaleString('es-PE'),
            },
          },
        },
      },
    });

    /* Cambiar datos según filtro de periodo */
    const filterEl = document.getElementById('revenueFilter');
    if (filterEl) {
      filterEl.addEventListener('change', () => {
        chart.data.datasets[0].data = DATA_MAP[filterEl.value] || DATA_TODAY;
        chart.update();
      });
    }
  });

})();


/* ============================================================
   5. GRÁFICO DE ESTADO DE FLOTA (Chart.js — donut)
   ============================================================ */
(function initFleetChart() {

  const FLEET_DATA = {
    labels: ['En ruta', 'En terminal', 'Disponible', 'Inactivo', 'Mantenimiento'],
    values: [12, 8, 32, 4, 2],
    colors: [
      'rgba(0,200,255,0.85)',
      'rgba(0,255,148,0.75)',
      'rgba(170,136,255,0.75)',
      'rgba(122,155,196,0.4)',
      'rgba(255,68,68,0.6)',
    ],
  };

  document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('chartFleet');
    if (!canvas || typeof Chart === 'undefined') return;

    new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels:   FLEET_DATA.labels,
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
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.parsed} unidades`,
            },
          },
        },
      },
    });

    /* Leyenda manual */
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
   6. MAPA GPS (Leaflet.js)
   Las coordenadas simulan la ruta Juli–Puno en Puno, Perú.
   ============================================================ */
(function initGPSMap() {

  /* Coordenadas de la ruta Juli → Puno */
  const ROUTE_COORDS = [
    [-16.2060, -69.4600], /* Juli */
    [-16.1500, -69.5200],
    [-16.0800, -69.5800],
    [-16.0100, -69.6400],
    [-15.9200, -69.8500],
    [-15.8400, -70.0200],
    [-15.8028, -70.0219], /* Puno */
  ];

  /* Vehículos demo con posiciones aproximadas a lo largo de la ruta */
  const VEHICLES_DEMO = [
    { code: '001', driver: 'E. Mamani',   pos: ROUTE_COORDS[1], status: 'moving',    route: 'Juli→Puno' },
    { code: '003', driver: 'A. Morales',  pos: ROUTE_COORDS[3], status: 'moving',    route: 'Juli→Puno' },
    { code: '007', driver: 'R. Quispe',   pos: ROUTE_COORDS[4], status: 'moving',    route: 'Juli→Puno' },
    { code: '012', driver: 'H. Condori',  pos: ROUTE_COORDS[5], status: 'stopped',   route: 'Puno→Juli' },
    { code: '018', driver: 'L. Flores',   pos: ROUTE_COORDS[2], status: 'moving',    route: 'Puno→Juli' },
    { code: '025', driver: 'F. Mamani',   pos: ROUTE_COORDS[0], status: 'terminal',  route: 'Juli' },
  ];

  document.addEventListener('DOMContentLoaded', () => {
    const mapEl = document.getElementById('gpsMap');
    if (!mapEl || typeof L === 'undefined') return;

    const map = L.map('gpsMap', { zoomControl: true, attributionControl: false })
      .setView([-15.97, -69.75], 10);

    /* Capa de mapa oscura */
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
    }).addTo(map);

    /* Línea de ruta */
    L.polyline(ROUTE_COORDS, {
      color: 'rgba(0,200,255,0.6)',
      weight: 3,
      dashArray: '6,4',
    }).addTo(map);

    /* Color de icono según estado */
    const COLOR_MAP = {
      moving:   '#00C8FF',
      stopped:  '#FFB800',
      terminal: '#7B8FAA',
    };

    /* Marcadores de vehículos */
    VEHICLES_DEMO.forEach(v => {
      const color = COLOR_MAP[v.status] || '#fff';

      const icon = L.divIcon({
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        html: `
          <div style="
            width:28px;height:28px;border-radius:50%;
            background:${color};
            border:2px solid rgba(255,255,255,0.5);
            display:flex;align-items:center;justify-content:center;
            font-size:9px;font-weight:700;color:#050818;
            box-shadow:0 0 10px ${color};
          ">${v.code}</div>
        `,
      });

      L.marker(v.pos, { icon })
        .bindPopup(`
          <div style="font-family:Inter,sans-serif;font-size:12px;min-width:140px">
            <strong style="color:#00C8FF">Unidad ${v.code}</strong><br>
            <span>Conductor: ${v.driver}</span><br>
            <span>Ruta: ${v.route}</span><br>
            <span>Estado: ${v.status}</span>
          </div>
        `)
        .addTo(map);
    });

    /* Puntos de inicio y fin */
    const endIcon = (label) => L.divIcon({
      className: '',
      iconSize: [50, 22],
      html: `<div style="
        background:rgba(0,0,20,0.85);border:1px solid rgba(0,200,255,0.4);
        color:#00C8FF;font-size:9px;font-weight:700;letter-spacing:0.1em;
        padding:3px 6px;border-radius:4px;white-space:nowrap;
      ">${label}</div>`,
    });

    L.marker(ROUTE_COORDS[0], { icon: endIcon('JULI') }).addTo(map);
    L.marker(ROUTE_COORDS[ROUTE_COORDS.length - 1], { icon: endIcon('PUNO') }).addTo(map);
  });

  /* Filtro de ruta (los botones cambian la capa visible — simplificado) */
  window.filterRoute = function(type, btn) {
    document.querySelectorAll('.dc-btn[data-route]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  };

})();


/* ============================================================
   7. ALERTAS OPERATIVAS
   ============================================================ */
(function initAlerts() {

  const ALERTS_DATA = [
    {
      type:    'speed',
      icon:    'fa-tachometer-alt',
      title:   'Velocidad excesiva — Unidad 014',
      message: 'Superó 90 km/h durante 5 min en ruta Juli→Puno',
      time:    'Hace 3 min',
    },
    {
      type:    'route',
      icon:    'fa-route',
      title:   'Desvío de ruta — Unidad 022',
      message: 'Detectado desvío de ~1.2 km en la ruta esperada',
      time:    'Hace 7 min',
    },
    {
      type:    'manifest',
      icon:    'fa-file-alt',
      title:   'Manifiesto sin cerrar — Unidad 007',
      message: 'El viaje finalizó hace 25 min y el manifiesto sigue abierto',
      time:    'Hace 25 min',
    },
    {
      type:    'success',
      icon:    'fa-check-circle',
      title:   'Manifiesto exportado — Unidad 003',
      message: 'MAN-2025-047 guardado y enviado por WhatsApp correctamente',
      time:    'Hace 31 min',
    },
    {
      type:    'route',
      icon:    'fa-pause-circle',
      title:   'Parada no programada — Unidad 031',
      message: 'Detenido por más de 8 min fuera del terminal',
      time:    'Hace 44 min',
    },
  ];

  document.addEventListener('DOMContentLoaded', () => {
    const list = document.getElementById('alertsList');
    if (!list) return;

    ALERTS_DATA.forEach(alert => {
      const item = document.createElement('div');
      item.className = `alert-item ${alert.type}`;
      item.innerHTML = `
        <div class="alert-icon"><i class="fas ${alert.icon}"></i></div>
        <div class="alert-body">
          <strong>${alert.title}</strong>
          <span>${alert.message}</span>
        </div>
        <span class="alert-time">${alert.time}</span>
      `;
      list.appendChild(item);
    });

    /* Actualizar badge */
    const bellCount = document.getElementById('bellCount');
    const alertCount = document.getElementById('alertCount');
    const critical = ALERTS_DATA.filter(a => a.type === 'speed' || a.type === 'route').length;
    if (bellCount)  bellCount.textContent  = critical;
    if (alertCount) alertCount.textContent = ALERTS_DATA.length;
  });

})();


/* ============================================================
   8. TABLA DE ÚLTIMOS VIAJES
   ============================================================ */
(function initTripsTable() {

  const TRIPS_DEMO = [
    { code: '001', driver: 'E. Mamani',   route: 'Juli→Puno',  time: '03:15', passengers: 12, status: 'done' },
    { code: '003', driver: 'A. Morales',  route: 'Juli→Puno',  time: '03:22', passengers: 10, status: 'active' },
    { code: '007', driver: 'R. Quispe',   route: 'Juli→Puno',  time: '04:10', passengers: 15, status: 'active' },
    { code: '012', driver: 'H. Condori',  route: 'Puno→Juli',  time: '05:30', passengers: 11, status: 'done' },
    { code: '018', driver: 'L. Flores',   route: 'Puno→Juli',  time: '06:00', passengers: 14, status: 'active' },
    { code: '022', driver: 'P. Turpo',    route: 'Juli→Puno',  time: '06:45', passengers: 9,  status: 'alert' },
  ];

  const STATUS_LABELS = {
    active: { cls: 'status-active', icon: 'fa-circle', label: 'En ruta' },
    done:   { cls: 'status-done',   icon: 'fa-check',  label: 'Completado' },
    alert:  { cls: 'status-alert',  icon: 'fa-exclamation', label: 'Alerta' },
  };

  document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('tripsBody');
    if (!tbody) return;

    TRIPS_DEMO.forEach(trip => {
      const s = STATUS_LABELS[trip.status];
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${trip.code}</strong></td>
        <td>${trip.driver}</td>
        <td>${trip.route}</td>
        <td>${trip.time}</td>
        <td>${trip.passengers}</td>
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
   9. BÚSQUEDA DE VEHÍCULOS
   ============================================================ */
(function initVehicleSearch() {

  const VEHICLES_DB = {
    '001': { plate: 'PUN-001', company: 'Virgen de Fátima',     type: 'Toyota HiAce',     driver: 'Eloy Mamani',   status: 'En ruta',    trips: 3, revenue: 252 },
    '002': { plate: 'PUN-002', company: 'Virgen de Fátima',     type: 'Toyota HiAce',     driver: 'José Quispe',   status: 'Terminal',   trips: 2, revenue: 168 },
    '003': { plate: 'PUN-003', company: 'Surandino',            type: 'Mercedes Sprinter', driver: 'A. Morales',   status: 'En ruta',    trips: 4, revenue: 420 },
    '004': { plate: 'PUN-004', company: 'Surandino',            type: 'Renault Master',    driver: 'Juan Pérez',   status: 'Disponible', trips: 1, revenue: 84  },
    '005': { plate: 'PUN-005', company: 'San Francisco de Borja', type: 'Toyota HiAce',   driver: 'C. Ticona',    status: 'En ruta',    trips: 3, revenue: 252 },
  };

  window.searchVehicle = function() {
    const query  = (document.getElementById('vehicleSearch')?.value || '').trim();
    const result = document.getElementById('vehicleResult');
    if (!result) return;

    if (!query) { result.innerHTML = ''; return; }

    /* Buscar por código o placa */
    let found = null;
    const qUpper = query.toUpperCase().replace(/^0+/, ''); /* quitar ceros iniciales */

    for (const [code, data] of Object.entries(VEHICLES_DB)) {
      if (
        code === query.padStart(3, '0') ||
        data.plate.toUpperCase() === qUpper ||
        data.plate.toUpperCase().replace(/[^A-Z0-9]/g, '').includes(qUpper)
      ) {
        found = { code, ...data };
        break;
      }
    }

    if (!found) {
      result.innerHTML = `
        <div style="padding:12px;font-size:0.84rem;color:var(--text-muted);">
          <i class="fas fa-search"></i> No se encontró ningún vehículo con "${query}"
        </div>`;
      return;
    }

    result.innerHTML = `
      <div class="vr-card">
        <div class="vr-row"><span>Código TipCar</span><strong>${found.code}</strong></div>
        <div class="vr-row"><span>Placa</span><strong>${found.plate}</strong></div>
        <div class="vr-row"><span>Empresa</span><strong>${found.company}</strong></div>
        <div class="vr-row"><span>Tipo</span><strong>${found.type}</strong></div>
        <div class="vr-row"><span>Conductor asignado</span><strong>${found.driver}</strong></div>
        <div class="vr-row"><span>Estado actual</span>
          <strong style="color:var(--primary)">${found.status}</strong>
        </div>
        <div class="vr-row"><span>Viajes hoy</span><strong>${found.trips}</strong></div>
        <div class="vr-row"><span>Recaudación hoy</span>
          <strong style="color:var(--gold)">S/. ${found.revenue}</strong>
        </div>
      </div>`;
  };

  /* Buscar al presionar Enter */
  document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('vehicleSearch');
    if (input) {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') window.searchVehicle();
      });
    }
  });

})();


/* ============================================================
   10. SIDEBAR TOGGLE (móvil)
   ============================================================ */
(function initSidebarToggle() {
  document.addEventListener('DOMContentLoaded', () => {
    const btn     = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    if (!btn || !sidebar) return;

    btn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  });
})();


/* ============================================================
   LOGOUT
   ============================================================ */
window.logout = function() {
  if (confirm('¿Cerrar sesión?')) {
    localStorage.removeItem('chaski_user');
    window.location.href = '../login.html';
  }
};
