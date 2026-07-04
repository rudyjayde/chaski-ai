/* ============================================================
   admin/queue.js — Cola de Salida (datos reales desde API)
   Chaski AI v2.0
   ============================================================ */

'use strict';

const QUEUE_API = '/api/queue';

function localDateStr(d) {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* ============================================================
   2. ESTADO
   ============================================================ */
let QUEUE        = [];
let activeRoute  = 'juli-puno';
let activeDate   = localDateStr(new Date()); // hoy en hora local

const POS_LABEL = {
  calling:   'Llamando',
  ramp1:     'Rampa 1',
  ramp2:     'Rampa 2',
  outside1:  'Exterior 1',
  outside2:  'Exterior 2',
  waiting:   'En espera',
  departed:  'Salió',
  cancelled: 'Cancelado',
};

const POS_BADGE = {
  calling:   'calling',
  ramp1:     'ramp',
  ramp2:     'ramp',
  outside1:  'outside',
  outside2:  'outside',
  waiting:   'waiting',
  departed:  'departed',
  cancelled: 'cancelled',
};

const IN_TERMINAL = ['calling', 'ramp1', 'ramp2', 'outside1', 'outside2'];


/* ============================================================
   3. CARGA DESDE API
   ============================================================ */
window.setQueueDate = function (mode, customDate) {
  const todayStr    = localDateStr(new Date());
  const tomorrow    = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = localDateStr(tomorrow);

  if (mode === 'today')    activeDate = todayStr;
  else if (mode === 'tomorrow') activeDate = tomorrowStr;
  else if (customDate)     activeDate = customDate;

  // Actualizar el input de fecha
  const inp = document.getElementById('queueDateInput');
  if (inp) inp.value = activeDate;

  // Resaltar el botón correcto
  document.getElementById('btnToday')   ?.classList.toggle('active', activeDate === todayStr);
  document.getElementById('btnTomorrow')?.classList.toggle('active', activeDate === tomorrowStr);

  // Mostrar la fecha en el encabezado de la tabla
  const lbl = document.getElementById('queueDateLabel');
  if (lbl) {
    const d   = new Date(activeDate + 'T12:00:00');
    lbl.textContent = d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  loadQueue();
};

async function loadQueue() {
  try {
    const res   = await authFetch(`${QUEUE_API}?route=${activeRoute}&date=${activeDate}`);
    const data  = await res.json();
    if (!data.ok) throw new Error(data.error);

    QUEUE = data.entries.map(e => ({
      id:         e.id,
      turn:       e.turn_number,
      unit:       e.vehicle_code || '???',
      plate:      e.plate || '—',
      company:    e.company || '—',
      driver:     `${e.first_name} ${e.last_name}`,
      driverId:   e.driver_id,
      position:   e.position,
      inscribed:  e.registered_at ? new Date(e.registered_at) : null,
      departure:  e.departure_at  ? new Date(e.departure_at)  : null,
      sanctioned: false,
    }));
  } catch (err) {
    console.error('[adminQueue] Error al cargar cola:', err.message);
    QUEUE = [];
  }

  updateQueueKPIs();
  renderQueueTable();
  renderTerminalDiagram();
  updateCompanyFilter();
}

window.switchRoute = function (route, btn) {
  activeRoute = route;
  document.querySelectorAll('.aq-route-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadQueue();
};


/* ============================================================
   4. KPI
   ============================================================ */
function updateQueueKPIs() {
  const departed   = QUEUE.filter(q => q.position === 'departed').length;
  const waiting    = QUEUE.filter(q => q.position === 'waiting').length;
  const inTerminal = QUEUE.filter(q => IN_TERMINAL.includes(q.position)).length;
  const companies  = new Set(QUEUE.map(q => q.company).filter(Boolean)).size;

  document.getElementById('qTotal').textContent      = QUEUE.length;
  document.getElementById('qDeparted').textContent   = departed;
  document.getElementById('qWaiting').textContent    = waiting;
  document.getElementById('qInTerminal').textContent = inTerminal;
  document.getElementById('qCompanies').textContent  = companies;
}


/* ============================================================
   5. FILTRO DE EMPRESA DINÁMICO
   ============================================================ */
function updateCompanyFilter() {
  const sel = document.getElementById('qFilterCompany');
  if (!sel) return;
  const current = sel.value;
  const companies = [...new Set(QUEUE.map(q => q.company).filter(c => c && c !== '—'))].sort();
  sel.innerHTML = '<option value="">Todas</option>' + companies.map(c =>
    `<option value="${c}" ${c === current ? 'selected' : ''}>${c}</option>`
  ).join('');
}


/* ============================================================
   6. TABLA
   ============================================================ */
function renderQueueTable() {
  const tbody   = document.getElementById('queueBody');
  const search  = (document.getElementById('qSearch')?.value || '').toLowerCase();
  const company = document.getElementById('qFilterCompany')?.value || '';

  const filtered = QUEUE.filter(q => {
    if (search && !`${q.unit} ${q.plate} ${q.driver}`.toLowerCase().includes(search)) return false;
    if (company && q.company !== company) return false;
    return true;
  });

  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--text-muted)">Sin registros para hoy</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(q => {
    const inscStr = q.inscribed ? q.inscribed.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '—';
    const depStr  = q.departure ? q.departure.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '—';
    const isDone  = q.position === 'departed' || q.position === 'cancelled';
    const rowStyle = isDone ? 'opacity:0.55' : '';
    const sanctBadge = q.sanctioned
      ? '<span style="display:inline-block;margin-left:5px;font-size:10px;color:var(--gold)"><i class="fas fa-gavel"></i></span>'
      : '';

    const statusCell = q.position === 'departed'
      ? '<span class="status-badge completed"><i data-lucide="check-circle"></i> Salió</span>'
      : q.position === 'cancelled'
        ? '<span class="status-badge" style="background:rgba(255,68,68,.15);color:var(--danger)"><i data-lucide="ban"></i> Cancelado</span>'
        : '<span class="status-badge transit"><i data-lucide="clock"></i> En espera</span>';

    const actionsCell = !isDone ? `
      <div class="q-act-group">
        <button class="q-act-btn q-act-cancel"  onclick="cancelTrip('${q.id}')"        title="Cancelar viaje"><i data-lucide="ban"></i></button>
        <button class="q-act-btn q-act-last"    onclick="sendToLast('${q.id}')"        title="Enviar al final"><i data-lucide="trending-down"></i></button>
        <button class="q-act-btn q-act-sanction" onclick="openSanctionModal('${q.id}')" title="Aplicar sanción"><i class="fas fa-gavel"></i></button>
      </div>` : '<span style="color:var(--text-muted);font-size:12px">—</span>';

    return `
      <tr style="${rowStyle}">
        <td style="font-family:'Rajdhani',sans-serif;font-weight:700;color:var(--primary);font-size:18px">${q.turn}</td>
        <td><span style="font-family:'Rajdhani',sans-serif;font-weight:700;color:var(--primary)">${q.unit}</span></td>
        <td style="color:var(--text-muted)">${q.plate}</td>
        <td style="font-size:12px;color:var(--text-sub)">${q.company}</td>
        <td>${q.driver}${sanctBadge}</td>
        <td><span class="pos-badge ${POS_BADGE[q.position]}">${POS_LABEL[q.position]}</span></td>
        <td style="color:var(--text-muted)">${inscStr}</td>
        <td>${depStr}</td>
        <td>${statusCell}</td>
        <td>${actionsCell}</td>
      </tr>`;
  }).join('');
}

document.getElementById('qSearch')?.addEventListener('input', renderQueueTable);
document.getElementById('qFilterCompany')?.addEventListener('change', renderQueueTable);


/* ============================================================
   7. DIAGRAMA DE POSICIONES
   ============================================================ */
function renderTerminalDiagram() {
  const slotMap = {
    calling:  document.getElementById('slotCalling'),
    ramp1:    document.getElementById('slotRamp1'),
    ramp2:    document.getElementById('slotRamp2'),
    outside1: document.getElementById('slotOut1'),
    outside2: document.getElementById('slotOut2'),
  };

  Object.values(slotMap).forEach(el => {
    if (el) { el.innerHTML = '—'; el.classList.add('empty'); }
  });

  QUEUE.forEach(q => {
    const slot = slotMap[q.position];
    if (!slot) return;
    slot.classList.remove('empty');
    slot.innerHTML = `${q.unit}<small>${q.driver.split(' ')[0]}</small>`;
  });

  const waitList = document.getElementById('qwWaitingList');
  if (!waitList) return;

  const waitItems = QUEUE.filter(q => q.position === 'waiting');
  if (waitItems.length === 0) {
    waitList.innerHTML = `<span class="qw-empty-wait">Sin unidades en espera</span>`;
    return;
  }

  waitList.innerHTML = waitItems.map(q => `
    <div class="qw-wait-chip">
      <span class="chip-num">${q.unit}</span>
      <span class="chip-pos">T${q.turn}</span>
    </div>`).join('');
}


/* ============================================================
   8. ACCIONES DE COLA (con API)
   ============================================================ */
async function cancelTrip(id) {
  const entry = QUEUE.find(q => q.id === id);
  if (!entry) return;
  if (!confirm(`¿Cancelar el viaje de ${entry.driver} (Unidad ${entry.unit})?\n\nEsta acción no se puede deshacer.`)) return;

  try {
    const res = await authFetch(`${QUEUE_API}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('API error');
    showQueueToast(`Viaje de ${entry.driver} cancelado`);
    loadQueue();
  } catch {
    entry.position = 'cancelled'; // fallback local
    renderQueueTable(); renderTerminalDiagram(); updateQueueKPIs();
    showQueueToast(`Viaje de ${entry.driver} cancelado (local)`);
  }
}
window.cancelTrip = cancelTrip;

async function sendToLast(id) {
  const entry = QUEUE.find(q => q.id === id);
  if (!entry) return;
  if (!confirm(`¿Enviar a ${entry.driver} (Unidad ${entry.unit}) al final de la cola?`)) return;

  const active  = QUEUE.filter(q => !['departed','cancelled'].includes(q.position) && q.id !== id);
  const maxTurn = active.length > 0 ? Math.max(...active.map(q => q.turn)) : entry.turn;
  const newTurn = maxTurn + 1;

  try {
    const res = await authFetch(`${QUEUE_API}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position: 'waiting', turn_number: newTurn }),
    });
    if (!res.ok) throw new Error('API error');
    showQueueToast(`${entry.driver} enviado al final de la cola`);
    loadQueue();
  } catch {
    entry.position = 'waiting'; entry.turn = newTurn;
    renderQueueTable(); renderTerminalDiagram(); updateQueueKPIs();
    showQueueToast(`${entry.driver} al final (local)`);
  }
}
window.sendToLast = sendToLast;


/* ============================================================
   9. CAMBIAR POSICIÓN DESDE DIAGRAMA (double click en slot)
   ============================================================ */
window.setPosition = async function (id, newPos) {
  try {
    await authFetch(`${QUEUE_API}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position: newPos }),
    });
    loadQueue();
  } catch (err) {
    console.error(err);
  }
};

window.markDeparted = async function (id) {
  const entry = QUEUE.find(q => q.id === id);
  if (!entry) return;
  if (!confirm(`¿Confirmar salida de ${entry.driver} (Unidad ${entry.unit})?`)) return;
  try {
    await authFetch(`${QUEUE_API}/${id}/depart`, { method: 'PUT' });
    showQueueToast(`${entry.driver} marcado como salido`);
    loadQueue();
  } catch {
    showQueueToast('Error al marcar salida');
  }
};


/* ============================================================
   10. MODAL SANCIÓN
   ============================================================ */
let _sanctionId = null;

function openSanctionModal(id) {
  const entry = QUEUE.find(q => q.id === id);
  if (!entry) return;
  _sanctionId = id;
  document.getElementById('sanctionDriverName').textContent = `${entry.driver} — Unidad ${entry.unit}`;
  document.getElementById('sanctionDesc').value = '';
  document.getElementById('sanctionModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
window.openSanctionModal = openSanctionModal;

function closeSanctionModal() {
  document.getElementById('sanctionModal').classList.remove('open');
  document.body.style.overflow = '';
  _sanctionId = null;
}
window.closeSanctionModal = closeSanctionModal;

document.getElementById('sanctionModal')?.addEventListener('click', function (e) {
  if (e.target === this) closeSanctionModal();
});

function applySanction() {
  const entry = QUEUE.find(q => q.id === _sanctionId);
  if (!entry) return;

  const reason = document.getElementById('sanctionReason').value;
  const desc   = document.getElementById('sanctionDesc').value.trim();
  const reasonLabels = {
    tardanza:  'Tardanza a la cola',
    velocidad: 'Exceso de velocidad',
    ausencia:  'Ausencia no justificada',
    conducta:  'Conducta inapropiada',
    otro:      'Otro motivo',
  };

  // Notificación al conductor via localStorage (compatibilidad)
  const key    = 'chaski_driver_notifs_' + (entry.driver.toLowerCase().replace(/\s+/g, '.').normalize('NFD').replace(/[̀-ͯ]/g, ''));
  const notifs = JSON.parse(localStorage.getItem(key) || '[]');
  notifs.unshift({ id: Date.now(), type: 'alert', read: false,
    msg: `Sanción: ${reasonLabels[reason]}`, sub: desc || 'Administración ATIPCAR', at: new Date().toISOString() });
  localStorage.setItem(key, JSON.stringify(notifs));

  entry.sanctioned = true;
  closeSanctionModal();
  renderQueueTable();
  showQueueToast(`Sanción aplicada a ${entry.driver}`);
}
window.applySanction = applySanction;


/* ============================================================
   11. TOAST + RELOJ + SIDEBAR
   ============================================================ */
function showQueueToast(msg) {
  let t = document.getElementById('queueToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'queueToast';
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:var(--success,#10b981);color:#fff;padding:11px 20px;border-radius:8px;z-index:9999;font-size:13px;transition:opacity .3s;pointer-events:none';
    document.body.appendChild(t);
  }
  t.textContent = '✓ ' + msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 3000);
}

/* ============================================================
   12. VISTA GENERAL DE FLOTA (Lista Madre)
   ============================================================ */
let _fleetData  = [];
let _fleetFilter = 'all';

const FLEET_STATUS = {
  calling:  { label:'🔴 LLAMANDO',  cls:'calling',  group:'calling'  },
  ramp1:    { label:'🟡 RAMPA 1',   cls:'ramp',     group:'ramp'     },
  ramp2:    { label:'🟡 RAMPA 2',   cls:'ramp',     group:'ramp'     },
  outside1: { label:'🔵 EXTERIOR 1',cls:'outside',  group:'outside'  },
  outside2: { label:'🔵 EXTERIOR 2',cls:'outside',  group:'outside'  },
  waiting:  { label:'⚪ EN ESPERA', cls:'waiting',  group:'waiting'  },
  departed: { label:'🟢 EN RUTA',   cls:'completed',group:'departed' },
  cancelled:{ label:'✗ CANCELADO',  cls:'',         group:'none'     },
};

const ROUTE_LABEL = { 'juli-puno':'Juli → Puno', 'puno-juli':'Puno → Juli' };

window.loadFleetStatus = async function () {
  const tbody = document.getElementById('fleetBody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text-muted)"><i data-lucide="loader" style="animation:spin 1s linear infinite"></i> Cargando…</td></tr>`;

  try {
    const res  = await authFetch('/api/queue/fleet');
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    _fleetData = data.drivers || [];
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--danger)">Error al cargar flota: ${err.message}</td></tr>`;
    return;
  }
  renderFleetTable();
};

window.filterFleet = function (filter, btn) {
  _fleetFilter = filter;
  document.querySelectorAll('.fleet-filter').forEach(b => b.style.fontWeight = '400');
  if (btn) btn.style.fontWeight = '700';
  renderFleetTable();
};

function renderFleetTable() {
  const tbody = document.getElementById('fleetBody');
  if (!tbody) return;

  let rows = _fleetData;

  if (_fleetFilter !== 'all') {
    rows = rows.filter(d => {
      const group = d.position ? (FLEET_STATUS[d.position]?.group || 'none') : 'none';
      return group === _fleetFilter;
    });
  }

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-muted)">Sin registros para este filtro</td></tr>`;
    return;
  }

  const today = localDateStr(new Date());

  tbody.innerHTML = rows.map(d => {
    const status  = d.position ? FLEET_STATUS[d.position] : null;
    const statusCell = status
      ? `<span class="pos-badge ${status.cls}" style="font-size:11px">${status.label}</span>`
      : `<span style="color:rgba(255,255,255,.25);font-size:12px">— Sin inscripción</span>`;

    const routeCell = d.route
      ? `<span style="font-size:12px;color:var(--text-sub)">${ROUTE_LABEL[d.route] || d.route}</span>`
      : '—';

    const turnCell = d.turn_number
      ? `<span style="font-family:'Rajdhani',sans-serif;font-weight:700;color:var(--primary)">#${d.turn_number}</span>`
      : '—';

    const dateCell = d.queue_date
      ? (() => {
          // pg puede devolver DATE como string "YYYY-MM-DD" o como Date object
          const qd = d.queue_date instanceof Date
            ? localDateStr(d.queue_date)
            : String(d.queue_date).substring(0, 10);
          const dd = new Date(qd + 'T12:00:00');
          if (isNaN(dd)) return `<span style="color:var(--text-muted);font-size:11px">${qd}</span>`;
          const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
          const isToday    = qd === today;
          const isTomorrow = qd === localDateStr(tomorrow);
          const lbl = isToday ? 'Hoy' : isTomorrow ? 'Mañana' : dd.toLocaleDateString('es-PE',{day:'numeric',month:'short'});
          return `<span style="font-size:11px;color:${isToday?'var(--primary)':'var(--text-muted)'}">${lbl}</span>`;
        })()
      : '—';

    const depCell = d.departure_at
      ? `<span style="font-size:12px;color:#10B981">${new Date(d.departure_at).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}</span>`
      : '—';

    return `<tr>
      <td><span style="font-family:'Rajdhani',sans-serif;font-weight:700;color:var(--primary)">${d.vehicle_code || '—'}</span></td>
      <td style="color:var(--text-muted);font-size:12px">${d.plate || '—'}</td>
      <td>${d.first_name} ${d.last_name}</td>
      <td style="font-size:12px;color:var(--text-sub)">${d.company || '—'}</td>
      <td>${statusCell}</td>
      <td>${routeCell}</td>
      <td>${turnCell}</td>
      <td>${dateCell}</td>
      <td>${depCell}</td>
    </tr>`;
  }).join('');
}

let _fleetViewActive = false;
window.toggleFleetView = function () {
  _fleetViewActive = !_fleetViewActive;
  const fleetDiv  = document.getElementById('fleetView');
  const queueDiv  = document.getElementById('queueView');
  const dateCtrl  = document.getElementById('dateControls');
  const tabFleet  = document.getElementById('tabFleet');

  if (_fleetViewActive) {
    fleetDiv?.style && (fleetDiv.style.display = '');
    queueDiv?.style && (queueDiv.style.display = 'none');
    dateCtrl?.style && (dateCtrl.style.display = 'none');
    if (tabFleet) { tabFleet.style.background = 'rgba(170,136,255,.25)'; tabFleet.style.borderColor = '#AA88FF'; }
    document.getElementById('tabJuliPuno')?.classList.remove('active');
    document.getElementById('tabPunoJuli')?.classList.remove('active');
    loadFleetStatus();
  } else {
    fleetDiv?.style && (fleetDiv.style.display = 'none');
    queueDiv?.style && (queueDiv.style.display = '');
    dateCtrl?.style && (dateCtrl.style.display = 'flex');
    if (tabFleet) { tabFleet.style.background = 'rgba(170,136,255,.1)'; tabFleet.style.borderColor = 'rgba(170,136,255,.4)'; }
    document.getElementById('tabJuliPuno')?.classList.add('active');
  }
};

/* ============================================================
   INIT
   ============================================================ */
// Inicializar con la fecha de hoy
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('queueDateInput');
  if (inp) inp.value = activeDate;
  document.getElementById('btnToday')?.classList.add('active');
});
setQueueDate('today');
setInterval(loadQueue, 30000); // refresca cada 30 s
setInterval(() => { if (_fleetViewActive) loadFleetStatus(); }, 30000); // actualizar flota si está activa
