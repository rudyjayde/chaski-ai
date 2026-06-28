/* ============================================================
   admin/gps.js — Módulo de Dispositivos GPS
   Chaski AI v2.0
   ============================================================ */

'use strict';

const API = '';

// ── Estado local ─────────────────────────────────────────────
let allDevices = [];

// ── Carga inicial ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadDevices();
  setInterval(loadDevices, 30000); // refrescar cada 30s
});

async function loadDevices() {
  try {
    const res  = await fetch(`${API}/api/gps-devices`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    allDevices = data.devices;
    renderKPIs(allDevices);
    renderTable(allDevices);
  } catch (err) {
    document.getElementById('devicesBody').innerHTML =
      `<tr><td colspan="8" class="table-loading" style="color:#FF6B6B">
        <i class="fas fa-exclamation-triangle"></i> Error: ${err.message}
      </td></tr>`;
  }
}

// ── KPIs ─────────────────────────────────────────────────────
function renderKPIs(devices) {
  const total      = devices.length;
  const online     = devices.filter(d => d.status === 'online').length;
  const assigned   = devices.filter(d => d.vehicle_id).length;
  const unassigned = devices.filter(d => !d.vehicle_id).length;

  document.getElementById('kpiTotal').textContent     = total;
  document.getElementById('kpiOnline').textContent    = online;
  document.getElementById('kpiAssigned').textContent  = assigned;
  document.getElementById('kpiUnassigned').textContent = unassigned;
}

// ── Tabla ────────────────────────────────────────────────────
function renderTable(devices) {
  const tbody = document.getElementById('devicesBody');
  if (!devices.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-loading">
      No hay dispositivos registrados. Registra el primero con el botón de arriba.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = devices.map(d => `
    <tr>
      <td><span class="imei-mono">${d.imei}</span></td>
      <td>
        <strong>${d.alias || '—'}</strong>
        <br><small style="color:var(--muted)">${d.model || 'Teltonika FMC130'}</small>
      </td>
      <td>${d.sim_number || '—'}</td>
      <td>${vehicleCell(d)}</td>
      <td style="font-size:0.82rem">${d.driver_name || '—'}</td>
      <td>${statusBadge(d.status)}</td>
      <td class="ping-time">${formatPing(d.last_ping, d.last_speed)}</td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="tbl-btn assign" onclick="openAssign('${d.id}','${d.imei}')">
            <i class="fas fa-link"></i> Asignar
          </button>
          <button class="tbl-btn edit" onclick="openEdit(${JSON.stringify(d).replace(/"/g, '&quot;')})">
            <i class="fas fa-pen"></i>
          </button>
          <button class="tbl-btn del" onclick="deleteDevice('${d.id}','${d.imei}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function vehicleCell(d) {
  if (!d.vehicle_id) return '<span style="color:var(--muted);font-size:0.8rem">Sin asignar</span>';
  return `<span class="vehicle-code-pill">
    <i class="fas fa-bus" style="font-size:0.7rem"></i>
    ${d.vehicle_code}
    <span class="plate">${d.vehicle_plate}</span>
  </span>`;
}

function statusBadge(status) {
  const MAP = {
    online:      ['signal',          'Online'],
    reciente:    ['clock',           'Reciente'],
    offline:     ['times-circle',    'Offline'],
    sin_señal:   ['question-circle', 'Sin señal'],
    sin_asignar: ['unlink',          'Sin asignar'],
  };
  const [icon, label] = MAP[status] || ['circle', status];
  return `<span class="status-badge ${status}"><i class="fas fa-${icon}"></i>${label}</span>`;
}

function formatPing(ping, speed) {
  if (!ping) return '<span style="color:var(--muted)">—</span>';
  const d    = new Date(ping);
  const time = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  const spd  = speed != null ? ` · ${parseFloat(speed).toFixed(0)} km/h` : '';
  return `${time}${spd}`;
}

// ── Filtro de búsqueda ────────────────────────────────────────
window.filterTable = function () {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const filtered = allDevices.filter(d =>
    d.imei.toLowerCase().includes(q) ||
    (d.alias || '').toLowerCase().includes(q) ||
    (d.vehicle_code || '').toLowerCase().includes(q) ||
    (d.vehicle_plate || '').toLowerCase().includes(q)
  );
  renderTable(filtered);
};

// ── Modal Registrar / Editar ─────────────────────────────────
window.openModal = function () {
  document.getElementById('modalTitle').innerHTML = '<i class="fas fa-satellite-dish"></i> Registrar Dispositivo GPS';
  document.getElementById('deviceId').value = '';
  document.getElementById('deviceForm').reset();
  document.getElementById('fModel').value = 'Teltonika FMC130';
  document.getElementById('formError').style.display = 'none';
  document.getElementById('modalOverlay').classList.add('open');
};

window.openEdit = function (d) {
  document.getElementById('modalTitle').innerHTML = '<i class="fas fa-pen"></i> Editar Dispositivo';
  document.getElementById('deviceId').value = d.id;
  document.getElementById('fImei').value    = d.imei;
  document.getElementById('fAlias').value   = d.alias  || '';
  document.getElementById('fModel').value   = d.model  || 'Teltonika FMC130';
  document.getElementById('fSim').value     = d.sim_number || '';
  document.getElementById('fNotes').value   = d.notes  || '';
  document.getElementById('formError').style.display = 'none';
  document.getElementById('modalOverlay').classList.add('open');
};

window.closeModal = function () {
  document.getElementById('modalOverlay').classList.remove('open');
};

window.closeModalOutside = function (e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
};

window.submitDevice = async function (e) {
  e.preventDefault();
  const id     = document.getElementById('deviceId').value;
  const errBox = document.getElementById('formError');
  errBox.style.display = 'none';

  const body = {
    imei:       document.getElementById('fImei').value.trim(),
    alias:      document.getElementById('fAlias').value.trim(),
    model:      document.getElementById('fModel').value.trim(),
    sim_number: document.getElementById('fSim').value.trim(),
    notes:      document.getElementById('fNotes').value.trim(),
  };

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando…';

  try {
    const url    = id ? `${API}/api/gps-devices/${id}` : `${API}/api/gps-devices`;
    const method = id ? 'PUT' : 'POST';
    const res    = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      errBox.textContent = data.error || 'Error al guardar';
      errBox.style.display = 'block';
      return;
    }

    closeModal();
    loadDevices();
  } catch (err) {
    errBox.textContent = 'Error de conexión con el servidor';
    errBox.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Guardar';
  }
};

// ── Modal Asignar ────────────────────────────────────────────
window.openAssign = function (deviceId, imei) {
  document.getElementById('assignDeviceId').value = deviceId;
  document.getElementById('assignImeiLabel').textContent = imei;
  document.getElementById('assignCode').value = '';
  document.getElementById('vehiclePreview').textContent = '';
  document.getElementById('assignError').style.display = 'none';
  document.getElementById('assignOverlay').classList.add('open');
};

window.closeAssign = function () {
  document.getElementById('assignOverlay').classList.remove('open');
};

window.closeAssignOutside = function (e) {
  if (e.target === document.getElementById('assignOverlay')) closeAssign();
};

// Preview mientras escribe el código
window.previewVehicle = async function (code) {
  const preview = document.getElementById('vehiclePreview');
  if (!code || code.length < 1) { preview.textContent = ''; return; }

  const padded = code.padStart(3, '0');
  try {
    const res  = await fetch(`${API}/api/vehicles`);
    const data = await res.json();
    const v    = (data.vehicles || []).find(v => v.code === padded);
    if (v) {
      preview.innerHTML = `<i class="fas fa-check-circle" style="color:#00FF94"></i> ${v.code} — ${v.plate} (${v.driver_name})`;
    } else {
      preview.innerHTML = `<span style="color:#FF6B6B"><i class="fas fa-times-circle"></i> Vehículo no encontrado</span>`;
    }
  } catch { preview.textContent = ''; }
};

window.confirmAssign = async function () {
  const id      = document.getElementById('assignDeviceId').value;
  const code    = document.getElementById('assignCode').value.trim();
  const errBox  = document.getElementById('assignError');
  errBox.style.display = 'none';

  if (!code) {
    errBox.textContent = 'Ingresa el código de vehículo';
    errBox.style.display = 'block';
    return;
  }

  try {
    const res  = await fetch(`${API}/api/gps-devices/${id}/assign`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicle_code: code }),
    });
    const data = await res.json();

    if (!res.ok) {
      errBox.textContent = data.error || 'Error al asignar';
      errBox.style.display = 'block';
      return;
    }

    closeAssign();
    loadDevices();
  } catch (err) {
    errBox.textContent = 'Error de conexión';
    errBox.style.display = 'block';
  }
};

window.unassignDevice = async function () {
  const id = document.getElementById('assignDeviceId').value;
  if (!confirm('¿Desasignar este dispositivo del vehículo actual?')) return;

  try {
    await fetch(`${API}/api/gps-devices/${id}/assign`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicle_code: null }),
    });
    closeAssign();
    loadDevices();
  } catch (err) {
    alert('Error al desasignar');
  }
};

// ── Eliminar ─────────────────────────────────────────────────
window.deleteDevice = async function (id, imei) {
  if (!confirm(`¿Eliminar el dispositivo IMEI ${imei}? Esta acción no se puede deshacer.`)) return;
  try {
    await fetch(`${API}/api/gps-devices/${id}`, { method: 'DELETE' });
    loadDevices();
  } catch (err) {
    alert('Error al eliminar');
  }
};

