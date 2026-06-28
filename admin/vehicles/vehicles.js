'use strict';

const API = '';

// ── Auth ─────────────────────────────────────────────────────
(function checkAuth() {
  const session = JSON.parse(localStorage.getItem('chaski_user') || 'null');
  if (!session || session.role !== 'admin') {
    window.location.href = '/login';
    return;
  }
  const nameEl = document.getElementById('adminUserName');
  if (nameEl) nameEl.textContent = session.name || 'Admin';
})();

window.logout = function () {
  localStorage.removeItem('chaski_user');
  window.location.href = '/login';
};

// ── Estado ───────────────────────────────────────────────────
let FLEET      = [];
let COMPANIES  = [];
let filteredFleet = [];
let currentView   = 'grid';

const STATUS_LABEL = { active: 'En operación', waiting: 'En espera', maintenance: 'Mantenimiento', inactive: 'Inactivo' };
const STATUS_ICON  = { active: 'fa-circle', waiting: 'fa-clock', maintenance: 'fa-wrench', inactive: 'fa-ban' };

// ── Carga inicial ─────────────────────────────────────────────
async function loadAll() {
  await Promise.all([loadVehicles(), loadCompanies()]);
}

async function loadVehicles() {
  try {
    const res  = await fetch(`${API}/api/vehicles`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    FLEET         = data.vehicles;
    filteredFleet = [...FLEET];
    renderVehicles();
  } catch (err) {
    document.getElementById('vehiclesGrid').innerHTML =
      `<div class="vh-empty"><i class="fas fa-exclamation-triangle"></i> Error al cargar: ${err.message}</div>`;
  }
}

async function loadCompanies() {
  try {
    const res  = await fetch(`${API}/api/vehicles/companies`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    COMPANIES = data.companies;
    populateCompanySelect('vhFilterCompany', true);
  } catch {}
}

function populateCompanySelect(selectId, withAll = false) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = withAll ? '<option value="">Todas las empresas</option>' : '<option value="">Seleccionar empresa…</option>';
  COMPANIES.forEach(c => {
    const opt = document.createElement('option');
    opt.value       = c.id;
    opt.textContent = c.name;
    if (c.id === current) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ── Filtros ───────────────────────────────────────────────────
function applyVhFilters() {
  const text    = (document.getElementById('vhSearch')?.value || '').toLowerCase();
  const company = document.getElementById('vhFilterCompany')?.value;
  const status  = document.getElementById('vhFilterStatus')?.value;

  filteredFleet = FLEET.filter(v => {
    if (text) {
      const h = `${v.code} ${v.plate} ${v.company} ${v.driver_name}`.toLowerCase();
      if (!h.includes(text)) return false;
    }
    if (company && v.company_id !== company) return false;
    if (status  && v.status    !== status)   return false;
    return true;
  });

  renderVehicles();
}

document.getElementById('vhSearch')?.addEventListener('input', applyVhFilters);
document.getElementById('vhFilterCompany')?.addEventListener('change', applyVhFilters);
document.getElementById('vhFilterStatus')?.addEventListener('change', applyVhFilters);

// ── Renderizado ───────────────────────────────────────────────
window.setView = function (view, btn) {
  currentView = view;
  document.querySelectorAll('.vh-view-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('vehiclesGrid').style.display  = view === 'grid' ? 'grid'  : 'none';
  document.getElementById('vehiclesList').style.display  = view === 'list' ? 'block' : 'none';
  renderVehicles();
};

function renderVehicles() {
  updateKPIStrip();
  currentView === 'grid' ? renderGrid() : renderList();
}

function renderGrid() {
  const grid = document.getElementById('vehiclesGrid');
  if (!grid) return;

  if (!filteredFleet.length) {
    grid.innerHTML = `<div class="vh-empty"><i class="fas fa-bus"></i> No se encontraron vehículos</div>`;
    return;
  }

  grid.innerHTML = filteredFleet.map(v => {
    const speedAlert = v.speed && parseFloat(v.speed) > 90;
    const gpsOk      = !!v.gps_device_id;
    const speed      = v.speed ? Math.round(parseFloat(v.speed)) : 0;

    return `
    <div class="vh-card ${v.status}" onclick="openVhModal('${v.id}')">
      <div class="vh-card-head">
        <div>
          <div class="vh-card-code">${v.code}</div>
          <div class="vh-card-plate">${v.plate}</div>
        </div>
        <div class="vh-card-gps">
          <div class="vh-gps-dot ${gpsOk ? 'online' : ''}"></div>
          <span class="vh-gps-speed ${speedAlert ? 'alert' : ''}">
            ${speed > 0 ? speed + ' km/h' : 'GPS ' + (gpsOk ? 'OK' : 'Off')}
          </span>
        </div>
      </div>
      <div class="vh-card-company">
        <i class="fas fa-building" style="color:var(--primary);margin-right:5px"></i>${v.company || '—'}
      </div>
      <div class="vh-card-driver">
        <i class="fas fa-user"></i>${v.driver_name}
      </div>
      <span class="vh-status-badge ${v.status}">
        <i class="fas ${STATUS_ICON[v.status] || 'fa-circle'}"></i>
        ${STATUS_LABEL[v.status] || v.status}
      </span>
      <div class="vh-card-stats">
        <div class="vh-stat">
          <span class="vh-stat-val">${v.brand || '—'}</span>
          <span class="vh-stat-lbl">Marca</span>
        </div>
        <div class="vh-stat">
          <span class="vh-stat-val">${v.model || '—'}</span>
          <span class="vh-stat-lbl">Modelo</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderList() {
  const tbody = document.getElementById('vehiclesListBody');
  if (!tbody) return;

  if (!filteredFleet.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--text-muted)">Sin vehículos</td></tr>`;
    return;
  }

  tbody.innerHTML = filteredFleet.map(v => `
    <tr>
      <td><span style="font-family:'Rajdhani',sans-serif;font-weight:700;color:var(--primary)">${v.code}</span></td>
      <td>${v.plate}</td>
      <td style="font-size:12px;color:var(--text-sub)">${v.company || '—'}</td>
      <td>${v.driver_name}</td>
      <td style="color:var(--text-muted)">${v.brand || '—'} ${v.model || ''}</td>
      <td>
        <span style="color:${v.gps_device_id ? 'var(--success)' : 'var(--text-muted)'}">
          <i class="fas fa-satellite-dish"></i> ${v.gps_device_id ? 'Asignado' : 'Sin GPS'}
        </span>
      </td>
      <td style="text-align:center">${v.year || '—'}</td>
      <td style="text-align:center">${v.capacity || '—'}</td>
      <td><span class="status-badge ${v.status}">${STATUS_LABEL[v.status] || v.status}</span></td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="tbl-btn" onclick="openVhModal('${v.id}')" title="Ver ficha"><i class="fas fa-eye"></i></button>
          <button class="tbl-btn edit" onclick="openEditModal(${JSON.stringify(v).replace(/"/g,'&quot;')})" title="Editar"><i class="fas fa-pen"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ── KPI ───────────────────────────────────────────────────────
function updateKPIStrip() {
  document.getElementById('vhTotal').textContent    = FLEET.length;
  document.getElementById('vhActive').textContent   = FLEET.filter(v => v.status === 'active').length;
  document.getElementById('vhWaiting').textContent  = FLEET.filter(v => v.status === 'waiting').length;
  document.getElementById('vhMaint').textContent    = FLEET.filter(v => v.status === 'maintenance').length;
  document.getElementById('vhInactive').textContent = FLEET.filter(v => v.status === 'inactive').length;
}

// ── Modal Ficha (ver detalle) ─────────────────────────────────
window.openVhModal = function (vhId) {
  const v = FLEET.find(x => x.id === vhId);
  if (!v) return;

  document.getElementById('modalVhCode').textContent = v.code;
  document.getElementById('modalVhMeta').textContent = `${v.plate} · ${v.company || '—'}`;

  document.getElementById('modalVhInfo').innerHTML = [
    { label: 'Empresa',    value: v.company || '—' },
    { label: 'Placa',      value: v.plate },
    { label: 'Marca',      value: v.brand || '—' },
    { label: 'Modelo',     value: v.model || '—' },
    { label: 'Año',        value: v.year  || '—' },
    { label: 'Capacidad',  value: v.capacity ? v.capacity + ' pasajeros' : '—' },
    { label: 'Conductor',  value: v.driver_name },
    { label: 'GPS',        value: v.gps_device_id ? 'Asignado' : 'Sin dispositivo' },
    { label: 'Estado',     value: `<span class="vh-status-badge ${v.status}"><i class="fas ${STATUS_ICON[v.status]}"></i> ${STATUS_LABEL[v.status]}</span>` },
  ].map(i => `<div class="mi-item"><span class="mi-label">${i.label}</span><span class="mi-value">${i.value}</span></div>`).join('');

  document.getElementById('modalVhTrips').innerHTML =
    `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px">Historial de viajes disponible próximamente</td></tr>`;

  document.getElementById('vhModalActions').innerHTML = `
    <button class="mf-btn-act ghost" onclick="closeVhModal()"><i class="fas fa-times"></i> Cerrar</button>
    <button class="mf-btn-act" style="background:rgba(255,68,68,0.1);color:#FF6B6B;border:1px solid rgba(255,68,68,0.3)"
      onclick="deleteVehicle('${v.id}','${v.code}')">
      <i class="fas fa-trash"></i> Eliminar
    </button>
    <button class="mf-btn-act" style="background:rgba(255,184,0,0.12);color:#FFB800;border:1px solid rgba(255,184,0,0.3)"
      onclick="closeVhModal();openEditModal(${JSON.stringify(v).replace(/"/g,'&quot;')})">
      <i class="fas fa-pen"></i> Editar
    </button>`;

  document.getElementById('vehicleModal').classList.add('open');
  document.body.style.overflow = 'hidden';
};

window.closeVhModal = function () {
  document.getElementById('vehicleModal').classList.remove('open');
  document.body.style.overflow = '';
};

window.deleteVehicle = async function (id, code) {
  if (!confirm(`¿Eliminar el vehículo ${code}?\nSe desactivará del sistema.`)) return;
  try {
    const res = await fetch(`${API}/api/vehicles/${id}`, { method: 'DELETE' });
    if (!res.ok) { alert('Error al eliminar'); return; }
    window.closeVhModal();
    await loadVehicles();
  } catch {
    alert('Error de conexión');
  }
};

document.getElementById('vehicleModal')?.addEventListener('click', function(e) {
  if (e.target === this) window.closeVhModal();
});

// ── Modal Registrar / Editar ──────────────────────────────────
window.openRegisterModal = function () {
  document.getElementById('regModalTitle').innerHTML = '<i class="fas fa-bus"></i> Registrar Vehículo';
  document.getElementById('regVehicleId').value = '';
  document.getElementById('vehicleRegForm').reset();
  document.getElementById('regCode').disabled    = false;
  document.getElementById('regFormError').style.display = 'none';
  populateCompanySelect('regCompany', false);
  document.getElementById('vehicleRegModal').classList.add('open');
};

window.openEditModal = function (v) {
  document.getElementById('regModalTitle').innerHTML = '<i class="fas fa-pen"></i> Editar Vehículo';
  document.getElementById('regVehicleId').value  = v.id;
  document.getElementById('regCode').value       = v.code;
  document.getElementById('regCode').disabled    = true;
  document.getElementById('regPlate').value      = v.plate;
  document.getElementById('regBrand').value      = v.brand    || '';
  document.getElementById('regModel').value      = v.model    || '';
  document.getElementById('regYear').value       = v.year     || '';
  document.getElementById('regCapacity').value   = v.capacity || '';
  document.getElementById('regStatus').value     = v.status   || 'waiting';
  document.getElementById('regFormError').style.display = 'none';
  populateCompanySelect('regCompany', false);
  setTimeout(() => { document.getElementById('regCompany').value = v.company_id || ''; }, 50);
  document.getElementById('vehicleRegModal').classList.add('open');
};

window.closeRegisterModal = function () {
  document.getElementById('vehicleRegModal').classList.remove('open');
};

window.closeRegModalOutside = function (e) {
  if (e.target === document.getElementById('vehicleRegModal')) window.closeRegisterModal();
};

window.submitVehicle = async function (e) {
  e.preventDefault();
  const id     = document.getElementById('regVehicleId').value;
  const errBox = document.getElementById('regFormError');
  errBox.style.display = 'none';

  const body = {
    association_code: document.getElementById('regCode').value.trim(),
    plate:            document.getElementById('regPlate').value.trim(),
    company_id:       document.getElementById('regCompany').value,
    brand:            document.getElementById('regBrand').value.trim(),
    model:            document.getElementById('regModel').value.trim(),
    year:             document.getElementById('regYear').value || null,
    capacity:         document.getElementById('regCapacity').value || null,
    status:           document.getElementById('regStatus').value,
  };

  const btn = document.getElementById('regSubmitBtn');
  btn.disabled  = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando…';

  try {
    const url    = id ? `${API}/api/vehicles/${id}` : `${API}/api/vehicles`;
    const method = id ? 'PUT' : 'POST';
    const res    = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      errBox.textContent    = data.error || 'Error al guardar';
      errBox.style.display  = 'block';
      return;
    }

    window.closeRegisterModal();
    await loadVehicles();
  } catch (err) {
    errBox.textContent   = 'Error de conexión con el servidor';
    errBox.style.display = 'block';
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Guardar';
  }
};

// ── Reloj y Sidebar ───────────────────────────────────────────
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

// ── Init ──────────────────────────────────────────────────────
loadAll();
