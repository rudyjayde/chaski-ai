'use strict';

const API = '';

// ── Estado ───────────────────────────────────────────────────
let DRIVERS   = [];
let COMPANIES = [];
let filtered  = [];

const AVATAR_COLORS = ['#0066CC','#00875A','#CF4B2B','#6554C0','#FF991F'];
const STATUS_LABEL  = { active:'Activo', driving:'En ruta', inactive:'Inactivo' };
const STATUS_ICON   = { active:'fa-circle', driving:'fa-road', inactive:'fa-ban' };

function avatarColor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function initials(first, last) {
  return ((first[0] || '') + (last[0] || '')).toUpperCase();
}

// ── Carga ─────────────────────────────────────────────────────
async function loadAll() {
  await Promise.all([loadDrivers(), loadCompanies()]);
}

async function loadDrivers() {
  try {
    const res  = await fetch(`${API}/api/drivers`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    DRIVERS  = data.drivers;
    filtered = [...DRIVERS];
    applyFilters();
  } catch (err) {
    document.getElementById('driversGrid').innerHTML =
      `<div style="color:#FF6B6B;padding:30px"><i class="fas fa-exclamation-triangle"></i> Error: ${err.message}</div>`;
  }
}

async function loadCompanies() {
  try {
    const res  = await fetch(`${API}/api/vehicles/companies`);
    const data = await res.json();
    if (!data.ok) return;
    COMPANIES = data.companies;
    // Repoblar filtro de empresa
    const sel = document.getElementById('drFilterCompany');
    if (sel) {
      const cur = sel.value;
      sel.innerHTML = '<option value="">Todas las empresas</option>';
      COMPANIES.forEach(c => {
        const o = document.createElement('option');
        o.value = c.id; o.textContent = c.name;
        if (c.id === cur) o.selected = true;
        sel.appendChild(o);
      });
    }
  } catch {}
}

function populateCompanySelect(id) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Seleccionar empresa…</option>';
  COMPANIES.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = c.name;
    if (c.id === cur) o.selected = true;
    sel.appendChild(o);
  });
}

// ── Filtros ───────────────────────────────────────────────────
function applyFilters() {
  const text    = (document.getElementById('drSearch')?.value || '').toLowerCase();
  const company = document.getElementById('drFilterCompany')?.value;
  const status  = document.getElementById('drFilterStatus')?.value;

  filtered = DRIVERS.filter(d => {
    const full = `${d.first_name} ${d.last_name} ${d.dni || ''} ${d.company || ''}`.toLowerCase();
    if (text    && !full.includes(text))           return false;
    if (company && d.company_id !== company)       return false;
    if (status  && (d.active ? 'active' : 'inactive') !== status) return false;
    return true;
  });
  renderGrid();
}

document.getElementById('drSearch')?.addEventListener('input', applyFilters);
document.getElementById('drFilterCompany')?.addEventListener('change', applyFilters);
document.getElementById('drFilterStatus')?.addEventListener('change', applyFilters);

// ── Grid ──────────────────────────────────────────────────────
const AVATAR_BORDER = ['rgba(0,200,255,0.5)','rgba(0,255,148,0.5)','rgba(255,184,0,0.5)','rgba(255,68,68,0.5)','rgba(138,80,255,0.5)'];

function renderGrid() {
  const grid = document.getElementById('driversGrid');
  if (!grid) return;

  if (!filtered.length) {
    grid.innerHTML = `<div class="dr-empty"><i class="fas fa-user-slash"></i>No se encontraron conductores</div>`;
    return;
  }

  grid.innerHTML = filtered.map((d, i) => {
    const name   = `${d.first_name} ${d.last_name}`;
    const init   = initials(d.first_name, d.last_name);
    const status = d.active ? 'active' : 'inactive';
    const cIdx   = i % AVATAR_BORDER.length;
    const border = AVATAR_BORDER[cIdx];

    return `
    <div class="dr-card ${status}" onclick="openDrModal('${d.id}')">
      <div class="dr-avatar" style="border-color:${border}">${init}</div>
      <div class="dr-card-name">${name}</div>
      <div class="dr-card-company">
        <i class="fas fa-building"></i> ${d.company || '—'}
      </div>
      ${d.vehicle_code
        ? `<div style="margin:4px 0"><span style="font-size:0.73rem;background:rgba(0,200,255,0.08);color:#00C8FF;border:1px solid rgba(0,200,255,0.2);border-radius:4px;padding:2px 8px"><i class="fas fa-bus" style="font-size:0.65rem"></i> ${d.vehicle_code}</span></div>`
        : `<div style="margin:4px 0;font-size:0.72rem;color:var(--text-muted)">Sin vehículo</div>`
      }
      <span class="status-badge ${status}">
        <i class="fas ${STATUS_ICON[status]}"></i> ${STATUS_LABEL[status]}
      </span>
      <div class="dr-card-mini">
        <div class="dr-mini-item">
          <span class="dr-mini-val" style="font-size:0.8rem">${d.username || '—'}</span>
          <span class="dr-mini-lbl">Usuario</span>
        </div>
        <div class="dr-mini-item">
          <span class="dr-mini-val" style="font-size:0.8rem">${d.dni || '—'}</span>
          <span class="dr-mini-lbl">DNI</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Modal Perfil ──────────────────────────────────────────────
window.openDrModal = function (dId) {
  const d = DRIVERS.find(x => x.id === dId);
  if (!d) return;

  const name  = `${d.first_name} ${d.last_name}`;
  const color = avatarColor(name);
  const init  = initials(d.first_name, d.last_name);

  document.getElementById('modalDrAvatar').style.background = color;
  document.getElementById('modalDrAvatar').textContent      = init;
  document.getElementById('modalDrName').textContent  = name;
  document.getElementById('modalDrMeta').textContent  = `${d.company || '—'} · ${d.dni || '—'}`;

  document.getElementById('modalDrInfo').innerHTML = [
    { label: 'Empresa',    value: d.company        || '—' },
    { label: 'DNI',        value: d.dni             || '—' },
    { label: 'Teléfono',   value: d.phone           || '—' },
    { label: 'Licencia',   value: d.license_number  || '—' },
    { label: 'Vehículo',   value: d.vehicle_code ? `${d.vehicle_code} — ${d.vehicle_plate}` : 'Sin asignar' },
    { label: 'Usuario',    value: d.username         || '—' },
    { label: 'Último login', value: d.last_login ? new Date(d.last_login).toLocaleString('es-PE') : 'Nunca' },
    { label: 'Estado',     value: `<span class="dr-status-badge ${d.active?'active':'inactive'}"><i class="fas ${d.active?'fa-circle':'fa-ban'}"></i> ${d.active?'Activo':'Inactivo'}</span>` },
  ].map(i => `<div class="mi-item"><span class="mi-label">${i.label}</span><span class="mi-value">${i.value}</span></div>`).join('');

  document.getElementById('modalDrStats').innerHTML = `
    <div class="dr-stat-box"><span>—</span><small>Viajes/mes</small></div>
    <div class="dr-stat-box"><span>—</span><small>Alertas</small></div>
    <div class="dr-stat-box"><span>—</span><small>Recaud.</small></div>`;

  document.getElementById('modalDrTrips').innerHTML =
    `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px">Sin registros de viajes aún</td></tr>`;

  // Guardar referencia al driver activo para los botones
  window._activeDrId   = d.id;
  window._activeDrName = `${d.first_name} ${d.last_name}`;

  const actBox = document.getElementById('drModalActions');
  if (actBox) {
    actBox.innerHTML = `
      <button class="mf-btn-act ghost" onclick="closeDrModal()"><i class="fas fa-times"></i> Cerrar</button>
      <button class="mf-btn-act" style="background:rgba(255,68,68,0.1);color:#FF6B6B;border:1px solid rgba(255,68,68,0.3)"
        onclick="deleteDriver(window._activeDrId, window._activeDrName)">
        <i class="fas fa-trash"></i> Eliminar
      </button>
      <button class="mf-btn-act" style="background:rgba(255,184,0,0.12);color:#FFB800;border:1px solid rgba(255,184,0,0.3)"
        onclick="closeDrModal();openEditDriverModal(window._activeDrId)">
        <i class="fas fa-pen"></i> Editar
      </button>
      <button class="mf-btn-act" style="background:rgba(0,200,255,0.1);color:#00C8FF;border:1px solid rgba(0,200,255,0.25)"
        onclick="closeDrModal();openPassModal(window._activeDrId)">
        <i class="fas fa-key"></i> Contraseña
      </button>`;
  }

  document.getElementById('driverModal').classList.add('open');
  document.body.style.overflow = 'hidden';
};

window.closeDrModal = function () {
  document.getElementById('driverModal').classList.remove('open');
  document.body.style.overflow = '';
};
document.getElementById('driverModal')?.addEventListener('click', function(e) {
  if (e.target === this) window.closeDrModal();
});

// ── Modal Registrar ───────────────────────────────────────────
window.openRegDriverModal = function () {
  document.getElementById('drRegTitle').innerHTML = '<i class="fas fa-user-plus"></i> Registrar Conductor';
  document.getElementById('drRegId').value = '';
  document.getElementById('driverRegForm').reset();
  document.getElementById('drPasswordGroup').style.display = '';
  document.getElementById('drPassword').required = true;
  document.getElementById('drRegError').style.display = 'none';
  populateCompanySelect('drCompany');
  document.getElementById('driverRegModal').classList.add('open');
};

window.openEditDriverModal = function (dId) {
  const d = DRIVERS.find(x => x.id === dId);
  if (!d) return;
  document.getElementById('drRegTitle').innerHTML = '<i class="fas fa-pen"></i> Editar Conductor';
  document.getElementById('drRegId').value      = d.id;
  document.getElementById('drFirstName').value  = d.first_name;
  document.getElementById('drLastName').value   = d.last_name;
  document.getElementById('drDni').value        = d.dni || '';
  document.getElementById('drPhone').value      = d.phone || '';
  document.getElementById('drLicense').value    = d.license_number || '';
  document.getElementById('drVehicleCode').value = d.vehicle_code || '';
  document.getElementById('drUsername').value   = d.username || '';
  document.getElementById('drPasswordGroup').style.display = 'none';
  document.getElementById('drPassword').required = false;
  document.getElementById('drRegError').style.display = 'none';
  populateCompanySelect('drCompany');
  setTimeout(() => { document.getElementById('drCompany').value = d.company_id || ''; }, 50);
  document.getElementById('driverRegModal').classList.add('open');
};

window.closeRegDriverModal = function () {
  document.getElementById('driverRegModal').classList.remove('open');
};
window.closeRegDriverOutside = function (e) {
  if (e.target === document.getElementById('driverRegModal')) window.closeRegDriverModal();
};

// Auto-generar username al escribir nombre/apellido
window.autoUsername = function () {
  if (document.getElementById('drRegId').value) return; // no auto en edición
  const fn = (document.getElementById('drFirstName').value.trim().split(' ')[0] || '')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const ln = (document.getElementById('drLastName').value.trim().split(' ')[0] || '')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (fn || ln) document.getElementById('drUsername').value = `${fn}.${ln}`.replace(/^\.|\.$/, '');
};

window.submitDriver = async function (e) {
  e.preventDefault();
  const id     = document.getElementById('drRegId').value;
  const errBox = document.getElementById('drRegError');
  errBox.style.display = 'none';

  const body = {
    first_name:     document.getElementById('drFirstName').value.trim(),
    last_name:      document.getElementById('drLastName').value.trim(),
    dni:            document.getElementById('drDni').value.trim(),
    phone:          document.getElementById('drPhone').value.trim(),
    license_number: document.getElementById('drLicense').value.trim(),
    company_id:     document.getElementById('drCompany').value,
    vehicle_code:   document.getElementById('drVehicleCode').value.trim(),
  };

  if (!id) {
    body.password = document.getElementById('drPassword').value;
    if (!body.password || body.password.length < 6) {
      errBox.textContent   = 'La contraseña debe tener al menos 6 caracteres';
      errBox.style.display = 'block';
      return;
    }
  }

  const btn = document.getElementById('drRegSubmit');
  btn.disabled  = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando…';

  try {
    const url    = id ? `${API}/api/drivers/${id}` : `${API}/api/drivers`;
    const method = id ? 'PUT' : 'POST';

    // Si edición y hay nuevo código de vehículo, llamar endpoint separado
    if (id && body.vehicle_code) {
      await fetch(`${API}/api/drivers/${id}/vehicle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicle_code: body.vehicle_code }),
      });
      delete body.vehicle_code;
    }

    const res  = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      errBox.textContent   = data.error || 'Error al guardar';
      errBox.style.display = 'block';
      return;
    }

    window.closeRegDriverModal();
    await loadDrivers();
  } catch (err) {
    errBox.textContent   = 'Error de conexión con el servidor';
    errBox.style.display = 'block';
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Guardar';
  }
};

// ── Modal Contraseña ──────────────────────────────────────────
window.openPassModal = function (dId) {
  document.getElementById('passDriverId').value = dId;
  document.getElementById('newPassword').value  = '';
  document.getElementById('passError').style.display = 'none';
  document.getElementById('passModal').classList.add('open');
};
window.closePassModal = function () {
  document.getElementById('passModal').classList.remove('open');
};
window.submitPassword = async function () {
  const id   = document.getElementById('passDriverId').value;
  const pass = document.getElementById('newPassword').value;
  const err  = document.getElementById('passError');
  err.style.display = 'none';

  if (!pass || pass.length < 6) {
    err.textContent   = 'Mínimo 6 caracteres';
    err.style.display = 'block';
    return;
  }
  try {
    const res  = await fetch(`${API}/api/drivers/${id}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pass }),
    });
    const data = await res.json();
    if (!res.ok) { err.textContent = data.error; err.style.display = 'block'; return; }
    window.closePassModal();
    alert('Contraseña actualizada correctamente');
  } catch {
    err.textContent   = 'Error de conexión';
    err.style.display = 'block';
  }
};

// ── Eliminar conductor ────────────────────────────────────────
window.deleteDriver = async function (dId, name) {
  if (!confirm(`¿Eliminar al conductor ${name}?\nSu cuenta quedará desactivada.`)) return;
  try {
    const res = await fetch(`${API}/api/drivers/${dId}`, { method: 'DELETE' });
    if (!res.ok) { alert('Error al eliminar'); return; }
    window.closeDrModal();
    await loadDrivers();
  } catch {
    alert('Error de conexión');
  }
};

// ── Mensaje (placeholder) ─────────────────────────────────────
window.sendDriverMessage = function () { alert('Función de mensajería próximamente'); };

// ── Init ──────────────────────────────────────────────────────
loadAll();
