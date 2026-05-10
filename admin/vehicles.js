/* ============================================================
   vehicles.js — Lógica de la página de Vehículos
   Chaski AI v2.0
   ============================================================
   Contenido:
   1.  Autenticación y sesión
   2.  Datos demo de vehículos
   3.  Filtros (búsqueda, empresa, estado)
   4.  Vista cuadrícula y vista lista
   5.  Modal de ficha técnica
   6.  KPI strip
   7.  Reloj y sidebar toggle
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
   2. DATOS DEMO DE VEHÍCULOS
   ============================================================ */
const COMPANIES  = ['Virgen de Fátima', 'Surandino', 'San Francisco de Borja', 'Virgen de Fátima II', 'San Miguel'];
const DRIVERS    = ['Eloy Mamani', 'José Quispe', 'Abraham Morales', 'Juan Pérez', 'Carlos Ticona',
                    'Roberto Flores', 'Marcos Huanca', 'David Condori', 'Felipe Apaza', 'Héctor Larico',
                    'Víctor Limachi', 'Arturo Ccama'];
const STATUSES   = ['active', 'active', 'active', 'waiting', 'waiting', 'maintenance', 'inactive'];
const VEHICLE_TYPES = ['Minibús', 'Bus', 'Microbus'];

/** Genera la flota completa (60 vehículos, 12 por empresa) */
const FLEET = (() => {
  const fleet = [];
  let id = 1;

  for (let ci = 0; ci < COMPANIES.length; ci++) {
    for (let v = 0; v < 12; v++) {
      const unit    = String(id).padStart(3, '0');
      const plate   = `PUN-${unit}`;
      const status  = STATUSES[Math.floor(Math.random() * STATUSES.length)];
      const dIdx    = (v + ci * 2) % DRIVERS.length;
      const speed   = status === 'active' ? Math.floor(Math.random() * 30) + 75 : 0;
      const trips   = status !== 'inactive' ? Math.floor(Math.random() * 4) + 1 : 0;
      const revenue = trips * (Math.floor(Math.random() * 15) + 5) * 7;
      const gpsOk   = status === 'active' || status === 'waiting';
      const year    = 2010 + Math.floor(Math.random() * 14);
      const capacity = VEHICLE_TYPES.includes('Bus') ? 30 : 22;

      fleet.push({
        id:          id++,
        unit,
        plate,
        company:     COMPANIES[ci],
        companyIdx:  ci,
        driver:      DRIVERS[dIdx],
        status,
        speed,
        trips,
        revenue,
        gpsOk,
        gpsDevice:   'Teltonika FMC130',
        year,
        type:        VEHICLE_TYPES[v % VEHICLE_TYPES.length],
        capacity:    Math.floor(Math.random() * 10) + 20,
        speedAlert:  speed > 90,
      });
    }
  }
  return fleet;
})();


/* ============================================================
   3. FILTROS
   ============================================================ */
let currentView   = 'grid';
let filteredFleet = [...FLEET];

function applyVhFilters() {
  const text    = (document.getElementById('vhSearch')?.value || '').toLowerCase();
  const company = document.getElementById('vhFilterCompany')?.value;
  const status  = document.getElementById('vhFilterStatus')?.value;

  filteredFleet = FLEET.filter(v => {
    if (text) {
      const h = `${v.unit} ${v.plate} ${v.company} ${v.driver}`.toLowerCase();
      if (!h.includes(text)) return false;
    }
    if (company !== '' && company !== undefined && String(v.companyIdx) !== company) return false;
    if (status  && v.status !== status) return false;
    return true;
  });

  renderVehicles();
}

/* Escuchar cambios en filtros */
document.getElementById('vhSearch')?.addEventListener('input', applyVhFilters);
document.getElementById('vhFilterCompany')?.addEventListener('change', applyVhFilters);
document.getElementById('vhFilterStatus')?.addEventListener('change', applyVhFilters);


/* ============================================================
   4. RENDERIZADO CUADRÍCULA / LISTA
   ============================================================ */
const STATUS_LABEL = { active: 'En operación', waiting: 'En espera', maintenance: 'Mantenimiento', inactive: 'Inactivo' };
const STATUS_ICON  = { active: 'fa-circle', waiting: 'fa-clock', maintenance: 'fa-wrench', inactive: 'fa-ban' };

function setView(view, btn) {
  currentView = view;
  document.querySelectorAll('.vh-view-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  document.getElementById('vehiclesGrid').style.display = view === 'grid' ? 'grid' : 'none';
  document.getElementById('vehiclesList').style.display = view === 'list' ? 'block' : 'none';

  renderVehicles();
}
window.setView = setView;

function renderVehicles() {
  updateKPIStrip();

  if (currentView === 'grid') {
    renderGrid();
  } else {
    renderList();
  }
}

/** Vista cuadrícula */
function renderGrid() {
  const grid = document.getElementById('vehiclesGrid');
  if (!grid) return;

  if (filteredFleet.length === 0) {
    grid.innerHTML = `
      <div class="vh-empty">
        <i class="fas fa-bus"></i>
        No se encontraron vehículos con los filtros aplicados
      </div>`;
    return;
  }

  grid.innerHTML = filteredFleet.map(v => `
    <div class="vh-card ${v.status}" onclick="openVhModal(${v.id})">
      <div class="vh-card-head">
        <div>
          <div class="vh-card-code">${v.unit}</div>
          <div class="vh-card-plate">${v.plate}</div>
        </div>
        <div class="vh-card-gps">
          <div class="vh-gps-dot ${v.gpsOk ? 'online' : ''}"></div>
          <span class="vh-gps-speed ${v.speedAlert ? 'alert' : ''}">
            ${v.status === 'active' ? v.speed + ' km/h' : 'GPS ' + (v.gpsOk ? 'OK' : 'Off')}
          </span>
        </div>
      </div>

      <div class="vh-card-company">
        <i class="fas fa-building" style="color:var(--primary);margin-right:5px"></i>${v.company}
      </div>
      <div class="vh-card-driver">
        <i class="fas fa-user"></i>${v.driver}
      </div>

      <span class="vh-status-badge ${v.status}">
        <i class="fas ${STATUS_ICON[v.status]}"></i>
        ${STATUS_LABEL[v.status]}
      </span>

      <div class="vh-card-stats">
        <div class="vh-stat">
          <span class="vh-stat-val">${v.trips}</span>
          <span class="vh-stat-lbl">Viajes hoy</span>
        </div>
        <div class="vh-stat">
          <span class="vh-stat-val" style="color:var(--gold)">S/${v.revenue}</span>
          <span class="vh-stat-lbl">Recaudación</span>
        </div>
      </div>
    </div>
  `).join('');
}

/** Vista lista (tabla) */
function renderList() {
  const tbody = document.getElementById('vehiclesListBody');
  if (!tbody) return;

  if (filteredFleet.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="10" style="text-align:center;padding:30px;color:var(--text-muted)">
        Sin vehículos encontrados
      </td></tr>`;
    return;
  }

  tbody.innerHTML = filteredFleet.map(v => `
    <tr>
      <td>
        <span style="font-family:'Rajdhani',sans-serif;font-weight:700;color:var(--primary)">${v.unit}</span>
      </td>
      <td>${v.plate}</td>
      <td style="font-size:12px;color:var(--text-sub)">${v.company}</td>
      <td>${v.driver}</td>
      <td style="color:var(--text-muted)">${v.type}</td>
      <td>
        <span style="color:${v.gpsOk ? 'var(--success)' : 'var(--text-muted)'}">
          <i class="fas fa-satellite-dish"></i>
          ${v.gpsOk ? 'Online' : 'Offline'}
        </span>
      </td>
      <td style="text-align:center">${v.trips}</td>
      <td class="${v.speedAlert ? 'danger' : ''}" style="${v.speedAlert ? 'color:var(--danger);font-weight:700' : 'color:var(--text-sub)'}">
        ${v.status === 'active' ? v.speed + ' km/h' : '—'}
        ${v.speedAlert ? '<i class="fas fa-exclamation-triangle"></i>' : ''}
      </td>
      <td>
        <span class="status-badge ${v.status}">${STATUS_LABEL[v.status]}</span>
      </td>
      <td>
        <button class="tbl-btn" onclick="openVhModal(${v.id})" title="Ver ficha">
          <i class="fas fa-eye"></i>
        </button>
      </td>
    </tr>
  `).join('');
}


/* ============================================================
   5. MODAL DE FICHA TÉCNICA
   ============================================================ */
function openVhModal(vhId) {
  const v = FLEET.find(x => x.id === vhId);
  if (!v) return;

  document.getElementById('modalVhCode').textContent = v.unit;
  document.getElementById('modalVhMeta').textContent = `${v.plate} · ${v.company}`;

  /* Info general */
  const infoEl = document.getElementById('modalVhInfo');
  if (infoEl) {
    infoEl.innerHTML = [
      { label: 'Empresa',       value: v.company },
      { label: 'Placa',         value: v.plate },
      { label: 'Tipo',          value: v.type },
      { label: 'Año',           value: v.year },
      { label: 'Capacidad',     value: v.capacity + ' pasajeros' },
      { label: 'Conductor',     value: v.driver },
      { label: 'GPS',           value: v.gpsDevice },
      { label: 'Estado GPS',    value: v.gpsOk ? 'Online' : 'Offline' },
      { label: 'Estado',        value: `<span class="vh-status-badge ${v.status}"><i class="fas ${STATUS_ICON[v.status]}"></i> ${STATUS_LABEL[v.status]}</span>` },
      { label: 'Vel. actual',   value: v.status === 'active' ? `${v.speed} km/h` : '—' },
      { label: 'Viajes hoy',    value: v.trips },
      { label: 'Recaudación',   value: `S/ ${v.revenue.toFixed(2)}` },
    ].map(item => `
      <div class="mi-item">
        <span class="mi-label">${item.label}</span>
        <span class="mi-value">${item.value}</span>
      </div>
    `).join('');
  }

  /* Últimos viajes del vehículo (5 ficticios) */
  const tripsBody = document.getElementById('modalVhTrips');
  if (tripsBody) {
    const rows = Array.from({ length: 5 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const pax = Math.floor(Math.random() * 20) + 5;
      return `<tr>
        <td>${d.toLocaleDateString('es-PE')}</td>
        <td>${v.driver}</td>
        <td style="text-align:center">${pax}</td>
        <td style="color:var(--gold)">S/ ${(pax * 7).toFixed(2)}</td>
        <td><span class="status-badge completed"><i class="fas fa-check-circle"></i> Completado</span></td>
      </tr>`;
    });
    tripsBody.innerHTML = rows.join('');
  }

  document.getElementById('vehicleModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeVhModal() {
  document.getElementById('vehicleModal').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('vehicleModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeVhModal();
});

window.openVhModal  = openVhModal;
window.closeVhModal = closeVhModal;


/* ============================================================
   6. KPI STRIP
   ============================================================ */
function updateKPIStrip() {
  const total = FLEET.length;
  const active = FLEET.filter(v => v.status === 'active').length;
  const waiting = FLEET.filter(v => v.status === 'waiting').length;
  const maint = FLEET.filter(v => v.status === 'maintenance').length;
  const inactive = FLEET.filter(v => v.status === 'inactive').length;

  document.getElementById('vhTotal').textContent   = total;
  document.getElementById('vhActive').textContent  = active;
  document.getElementById('vhWaiting').textContent = waiting;
  document.getElementById('vhMaint').textContent   = maint;
  document.getElementById('vhInactive').textContent = inactive;
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
  renderVehicles();
})();
