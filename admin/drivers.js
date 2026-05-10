/* ============================================================
   drivers.js — Lógica de la página de Conductores
   Chaski AI v2.0
   ============================================================
   Contenido:
   1.  Autenticación y sesión
   2.  Datos demo de conductores
   3.  Filtros (búsqueda, empresa, estado)
   4.  Renderizado del grid de tarjetas
   5.  Modal de perfil completo
   6.  Reloj y sidebar toggle
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
   2. DATOS DEMO DE CONDUCTORES
   ============================================================ */
const COMPANIES = ['Virgen de Fátima', 'Surandino', 'San Francisco de Borja', 'Virgen de Fátima II', 'San Miguel'];

const DRIVER_NAMES = [
  'Eloy Mamani',      'José Quispe',       'Abraham Morales',   'Juan Pérez',
  'Carlos Ticona',    'Roberto Flores',    'Marcos Huanca',     'David Condori',
  'Felipe Apaza',     'Héctor Larico',     'Víctor Limachi',    'Arturo Ccama',
  'Miguel Calisaya',  'Raúl Pari',         'Esteban Mamani',    'Daniel Quispe',
  'Sergio Chua',      'Oscar Flores',      'Iván Ramos',        'Pedro Choque',
];

/** Genera el color de avatar basado en el índice de empresa */
const AVATAR_COLORS = [
  '#0d3b5e', '#0d4f3b', '#4f3b0d', '#4f0d0d', '#2d0d4f',
];

/** Construye la lista completa de conductores */
const DRIVERS = DRIVER_NAMES.map((name, i) => {
  const companyIdx = i % COMPANIES.length;
  const dni        = String(20000000 + i * 1234567 % 70000000);
  const status     = ['active', 'active', 'driving', 'inactive'][i % 4];
  const tripsMonth = Math.floor(Math.random() * 60) + 20;
  const paxMonth   = tripsMonth * (Math.floor(Math.random() * 10) + 8);
  const revMonth   = paxMonth * 7.0;
  const speedAlerts = Math.floor(Math.random() * 5);
  const initials   = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const username   = name.toLowerCase().replace(/\s+/g, '.');

  return {
    id:          i + 1,
    name,
    initials,
    dni,
    username,
    companyIdx,
    company:     COMPANIES[companyIdx],
    status,
    tripsMonth,
    paxMonth,
    revMonth,
    speedAlerts,
    license:     'AIII',
    phone:       `+51 9${String(Math.floor(Math.random() * 90000000) + 10000000)}`,
    joinYear:    2015 + (i % 8),
    vehicle:     String(i + 1).padStart(3, '0'),
  };
});


/* ============================================================
   3. FILTROS
   ============================================================ */
const STATUS_LABEL = { active: 'Activo', driving: 'En ruta', inactive: 'Inactivo' };
const STATUS_ICON  = { active: 'fa-check-circle', driving: 'fa-truck-moving', inactive: 'fa-ban' };

let filteredDrivers = [...DRIVERS];

function applyDrFilters() {
  const text    = (document.getElementById('drSearch')?.value    || '').toLowerCase();
  const company = document.getElementById('drFilterCompany')?.value;
  const status  = document.getElementById('drFilterStatus')?.value;

  filteredDrivers = DRIVERS.filter(d => {
    if (text) {
      const h = `${d.name} ${d.dni} ${d.company} ${d.username}`.toLowerCase();
      if (!h.includes(text)) return false;
    }
    if (company !== '' && company !== undefined && String(d.companyIdx) !== company) return false;
    if (status && d.status !== status) return false;
    return true;
  });

  renderDriversGrid();
}

document.getElementById('drSearch')?.addEventListener('input', applyDrFilters);
document.getElementById('drFilterCompany')?.addEventListener('change', applyDrFilters);
document.getElementById('drFilterStatus')?.addEventListener('change', applyDrFilters);


/* ============================================================
   4. RENDERIZADO DEL GRID
   ============================================================ */
function renderDriversGrid() {
  const grid = document.getElementById('driversGrid');
  if (!grid) return;

  if (filteredDrivers.length === 0) {
    grid.innerHTML = `
      <div class="dr-empty">
        <i class="fas fa-id-card"></i>
        No se encontraron conductores con los filtros aplicados
      </div>`;
    return;
  }

  grid.innerHTML = filteredDrivers.map(d => `
    <div class="dr-card" onclick="openDrModal(${d.id})">

      <!-- Avatar con iniciales -->
      <div class="dr-avatar c${d.companyIdx}"
           style="background:${AVATAR_COLORS[d.companyIdx]}">${d.initials}</div>

      <div class="dr-card-name">${d.name}</div>
      <div class="dr-card-company">
        <i class="fas fa-building" style="margin-right:4px;color:var(--primary)"></i>${d.company}
      </div>

      <!-- Badge de estado -->
      <span class="status-badge ${d.status}">
        <i class="fas ${STATUS_ICON[d.status]}"></i> ${STATUS_LABEL[d.status]}
      </span>

      <!-- Mini estadísticas -->
      <div class="dr-card-mini">
        <div class="dr-mini-item">
          <span class="dr-mini-val">${d.tripsMonth}</span>
          <span class="dr-mini-lbl">Viajes/mes</span>
        </div>
        <div class="dr-mini-item">
          <span class="dr-mini-val">${d.speedAlerts}</span>
          <span class="dr-mini-lbl" style="color:${d.speedAlerts > 0 ? 'var(--danger)' : 'var(--text-muted)'}">Alertas</span>
        </div>
        <div class="dr-mini-item">
          <span class="dr-mini-val" style="color:var(--gold)">S/${Math.round(d.revMonth)}</span>
          <span class="dr-mini-lbl">Recaud.</span>
        </div>
      </div>

    </div>
  `).join('');
}


/* ============================================================
   5. MODAL DE PERFIL
   ============================================================ */
let currentDriverId = null;

function openDrModal(driverId) {
  const d = DRIVERS.find(x => x.id === driverId);
  if (!d) return;
  currentDriverId = driverId;

  /* Avatar en modal */
  const avatarEl = document.getElementById('modalDrAvatar');
  if (avatarEl) {
    avatarEl.textContent = d.initials;
    avatarEl.className   = `dr-modal-avatar c${d.companyIdx}`;
    avatarEl.style.background = AVATAR_COLORS[d.companyIdx];
  }

  document.getElementById('modalDrName').textContent = d.name;
  document.getElementById('modalDrMeta').textContent = `${d.company} · Unidad ${d.vehicle}`;

  /* Info general */
  const infoEl = document.getElementById('modalDrInfo');
  if (infoEl) {
    infoEl.innerHTML = [
      { label: 'Nombre',      value: d.name },
      { label: 'DNI',         value: d.dni },
      { label: 'Usuario',     value: d.username },
      { label: 'Empresa',     value: d.company },
      { label: 'Vehículo',    value: d.vehicle },
      { label: 'Licencia',    value: d.license },
      { label: 'Teléfono',    value: d.phone },
      { label: 'Desde',       value: d.joinYear },
      { label: 'Estado',      value: `<span class="status-badge ${d.status}"><i class="fas ${STATUS_ICON[d.status]}"></i> ${STATUS_LABEL[d.status]}</span>` },
    ].map(item => `
      <div class="mi-item">
        <span class="mi-label">${item.label}</span>
        <span class="mi-value">${item.value}</span>
      </div>
    `).join('');
  }

  /* Stats de rendimiento */
  const statsEl = document.getElementById('modalDrStats');
  if (statsEl) {
    statsEl.innerHTML = [
      { val: d.tripsMonth,              cls: 'primary', lbl: 'Viajes / mes' },
      { val: d.paxMonth,                cls: 'success', lbl: 'Pasajeros / mes' },
      { val: `S/ ${d.revMonth.toFixed(2)}`, cls: 'gold', lbl: 'Recaudación / mes' },
      { val: d.speedAlerts,             cls: d.speedAlerts > 0 ? 'danger' : '', lbl: 'Alertas velocidad' },
    ].map(s => `
      <div class="dr-stat-card">
        <span class="dr-stat-val ${s.cls}">${s.val}</span>
        <span class="dr-stat-lbl">${s.lbl}</span>
      </div>
    `).join('');
  }

  /* Últimos viajes */
  const tripsEl = document.getElementById('modalDrTrips');
  if (tripsEl) {
    const rows = Array.from({ length: 5 }, (_, i) => {
      const dd  = new Date();
      dd.setDate(dd.getDate() - i);
      const pax = Math.floor(Math.random() * 20) + 5;
      return `<tr>
        <td>${dd.toLocaleDateString('es-PE')}</td>
        <td style="color:var(--primary);font-family:'Rajdhani',sans-serif;font-weight:700">${d.vehicle}</td>
        <td style="text-align:center">${pax}</td>
        <td style="color:var(--gold)">S/ ${(pax * 7).toFixed(2)}</td>
        <td><span class="status-badge completed"><i class="fas fa-check-circle"></i> Completado</span></td>
      </tr>`;
    });
    tripsEl.innerHTML = rows.join('');
  }

  document.getElementById('driverModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDrModal() {
  document.getElementById('driverModal').classList.remove('open');
  document.body.style.overflow = '';
  currentDriverId = null;
}

document.getElementById('driverModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeDrModal();
});

function sendDriverMessage() {
  const d = DRIVERS.find(x => x.id === currentDriverId);
  if (!d) return;

  const type = document.getElementById('msgType')?.value || 'info';
  const text = (document.getElementById('msgText')?.value || '').trim();
  if (!text) {
    alert('⚠️ Escribe un mensaje antes de enviar.');
    document.getElementById('msgText')?.focus();
    return;
  }

  const key    = 'chaski_driver_notifs_' + d.username;
  const notifs = JSON.parse(localStorage.getItem(key) || '[]');
  notifs.unshift({
    id:   Date.now(),
    type,
    read: false,
    msg:  text,
    sub:  `Admin ATIPCAR · ${new Date().toLocaleString('es-PE', { dateStyle:'short', timeStyle:'short' })}`,
    at:   new Date().toISOString(),
  });
  localStorage.setItem(key, JSON.stringify(notifs));

  document.getElementById('msgText').value = '';
  alert(`✅ Mensaje enviado a ${d.name}.\nEl conductor lo verá en su panel de notificaciones.`);
}

window.openDrModal        = openDrModal;
window.closeDrModal       = closeDrModal;
window.sendDriverMessage  = sendDriverMessage;


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
  renderDriversGrid();
})();
