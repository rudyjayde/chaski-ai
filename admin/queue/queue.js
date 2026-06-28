/* ============================================================
   admin/queue.js — Cola de Salida (datos reales desde API)
   Chaski AI v2.0
   ============================================================ */

'use strict';

const QUEUE_API = '/api/queue';

/* ============================================================
   2. ESTADO
   ============================================================ */
let QUEUE        = [];
let activeRoute  = 'juli-puno';

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
async function loadQueue() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const res   = await fetch(`${QUEUE_API}?route=${activeRoute}&date=${today}`);
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
      ? '<span class="status-badge completed"><i class="fas fa-check-circle"></i> Salió</span>'
      : q.position === 'cancelled'
        ? '<span class="status-badge" style="background:rgba(255,68,68,.15);color:var(--danger)"><i class="fas fa-ban"></i> Cancelado</span>'
        : '<span class="status-badge transit"><i class="fas fa-clock"></i> En espera</span>';

    const actionsCell = !isDone ? `
      <div class="q-act-group">
        <button class="q-act-btn q-act-cancel"  onclick="cancelTrip('${q.id}')"        title="Cancelar viaje"><i class="fas fa-ban"></i></button>
        <button class="q-act-btn q-act-last"    onclick="sendToLast('${q.id}')"        title="Enviar al final"><i class="fas fa-arrow-down"></i></button>
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
    const res = await fetch(`${QUEUE_API}/${id}`, { method: 'DELETE' });
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
    const res = await fetch(`${QUEUE_API}/${id}`, {
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
    await fetch(`${QUEUE_API}/${id}`, {
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
    await fetch(`${QUEUE_API}/${id}/depart`, { method: 'PUT' });
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
   INIT
   ============================================================ */
loadQueue();
setInterval(loadQueue, 30000); // refresca cada 30 s
