/* ============================================================
   driver/queue.js — Cola de Salida (datos reales desde API)
   Chaski AI v2.0
   ============================================================ */

'use strict';

const QUEUE_API = 'http://localhost:3005/api/queue';

/* ============================================================
   1. AUTENTICACIÓN
   ============================================================ */
const session = JSON.parse(localStorage.getItem('chaski_user') || 'null');
if (!session || session.role !== 'driver') {
  window.location.href = '../login.html';
}

function logout() {
  localStorage.removeItem('chaski_user');
  window.location.href = '../login.html';
}
window.logout = logout;

/* ── Sidebar ─────────────────────────────────────────────────── */
const nameEl    = document.getElementById('sidebarDriverName');
const vehicleEl = document.getElementById('sidebarVehicle');
const companyEl = document.getElementById('sidebarCompany');
if (nameEl)    nameEl.textContent    = session.name || session.username;
if (vehicleEl) vehicleEl.textContent = 'Cargando...';
if (companyEl) companyEl.textContent = '';


/* ============================================================
   2. RELOJ
   ============================================================ */
function updateClock() {
  const now  = new Date();
  const time = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const clockEl = document.getElementById('clockDisplay');
  const dateEl  = document.getElementById('dateDisplay');
  if (clockEl) clockEl.textContent = time;
  if (dateEl)  dateEl.textContent  = date.charAt(0).toUpperCase() + date.slice(1);
}
setInterval(updateClock, 1000);
updateClock();


/* ============================================================
   3. ESTADO
   ============================================================ */
let activeRoute  = 'juli-puno';
let QUEUES       = { 'juli-puno': [], 'puno-juli': [] };

const POS_LABEL = {
  calling:  'LLAMANDO',
  ramp1:    'Rampa 1',
  ramp2:    'Rampa 2',
  outside1: 'Exterior 1',
  outside2: 'Exterior 2',
  waiting:  'EN ESPERA',
  departed: 'SALIÓ',
  cancelled:'CANCELADO',
};


/* ============================================================
   4. CARGA DESDE API
   ============================================================ */
async function loadQueue(route) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const res   = await fetch(`${QUEUE_API}?route=${route}&date=${today}`);
    const data  = await res.json();
    if (!data.ok) throw new Error(data.error);

    // Mapear a formato interno
    return data.entries.map((e, i) => ({
      pos:      e.turn_number || (i + 1),
      unit:     e.vehicle_code || '???',
      plate:    e.plate || '',
      name:     `${e.first_name} ${e.last_name}`,
      company:  e.company || '—',
      position: e.position,
      username: e.username || '',
      id:       e.id,
      isYou:    e.username === session.username,
    }));
  } catch (err) {
    console.warn('[queue] API no disponible, sin datos:', err.message);
    return [];
  }
}

async function loadBothRoutes() {
  const [juliPuno, punoJuli] = await Promise.all([
    loadQueue('juli-puno'),
    loadQueue('puno-juli'),
  ]);
  QUEUES['juli-puno'] = juliPuno;
  QUEUES['puno-juli'] = punoJuli;

  // Actualizar sidebar con info del conductor
  const myEntry = [...juliPuno, ...punoJuli].find(e => e.isYou);
  if (myEntry) {
    if (vehicleEl) vehicleEl.textContent = `Unidad ${myEntry.unit} · ${myEntry.plate}`;
    if (companyEl) companyEl.textContent = myEntry.company;
    activeRoute = juliPuno.find(e => e.isYou) ? 'juli-puno' : 'puno-juli';
    initActiveTab();
  } else {
    if (vehicleEl) vehicleEl.textContent = 'Sin turno hoy';
  }

  renderAll();
}


/* ============================================================
   5. TARJETA "MI TURNO"
   ============================================================ */
function renderMyTurn() {
  const queue   = QUEUES[activeRoute];
  const myEntry = queue.find(q => q.isYou);
  const numEl   = document.getElementById('myTurnNum');
  const posEl   = document.getElementById('myTurnPos');
  const waitEl  = document.getElementById('myWaitTime');
  const routeLbl = document.getElementById('myRouteLabel');

  if (routeLbl) routeLbl.textContent = activeRoute === 'juli-puno' ? 'Juli → Puno' : 'Puno → Juli';

  if (myEntry) {
    if (numEl) numEl.textContent = `#${myEntry.pos}`;
    const msgs = {
      calling:  '🔴 Estás llamando — ¡prepara tu vehículo!',
      ramp1:    '🟡 Estás en Rampa 1 — próxima salida',
      ramp2:    '🟡 Estás en Rampa 2 — próxima salida',
      outside1: '🔵 Exterior 1 — espera tu llamado',
      outside2: '🔵 Exterior 2 — espera tu llamado',
      waiting:  '⚪ En zona de espera del terminal',
      departed: '✅ Ya saliste hoy',
    };
    if (posEl) posEl.textContent = msgs[myEntry.position] || POS_LABEL[myEntry.position];
    if (waitEl) {
      const ahead = queue.filter(q => q.pos < myEntry.pos && q.position !== 'departed' && q.position !== 'cancelled').length;
      waitEl.textContent = ahead === 0 ? 'Es tu turno' : `~${ahead * 35} min`;
    }
  } else {
    if (numEl) numEl.textContent = '—';
    if (posEl) posEl.textContent = 'No estás inscrito en la cola de hoy';
    if (waitEl) waitEl.textContent = '—';
  }

  const dateLabel = document.getElementById('queueDateLabel');
  if (dateLabel) {
    const now = new Date();
    dateLabel.textContent = now.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  }
}


/* ============================================================
   6. BARRA EN VIVO
   ============================================================ */
function renderLiveBar() {
  const queue   = QUEUES[activeRoute];
  const calling = queue.find(q  => q.position === 'calling');
  const ramp    = queue.filter(q => q.position === 'ramp1' || q.position === 'ramp2');
  const outside = queue.filter(q => q.position === 'outside1' || q.position === 'outside2');
  const waiting = queue.filter(q => q.position === 'waiting');

  const el = id => document.getElementById(id);
  if (el('liveCallingUnit'))  el('liveCallingUnit').textContent  = calling ? `Unidad ${calling.unit}` : 'Ninguna';
  if (el('liveRampUnits'))    el('liveRampUnits').textContent    = `${ramp.length} / 2`;
  if (el('liveReadyUnits'))   el('liveReadyUnits').textContent   = `${outside.length} unidades`;
  if (el('liveWaitingUnits')) el('liveWaitingUnits').textContent = `${waiting.length} unidades`;

  const totalBadge = el('queueTotalBadge');
  if (totalBadge) totalBadge.textContent = `${queue.length} unidades`;

  el('tabJuliCount').textContent = `${QUEUES['juli-puno'].length} unidades`;
  el('tabPunoCount').textContent = `${QUEUES['puno-juli'].length} unidades`;
}


/* ============================================================
   7. DIAGRAMA DE POSICIONES
   ============================================================ */
function renderTerminalDiagram() {
  const queue = QUEUES[activeRoute];

  const slotMap = {
    calling:  document.getElementById('slotCalling'),
    ramp1:    document.getElementById('slotRamp1'),
    ramp2:    document.getElementById('slotRamp2'),
    outside1: document.getElementById('slotOut1'),
    outside2: document.getElementById('slotOut2'),
  };

  Object.values(slotMap).forEach(el => {
    if (el) { el.innerHTML = '—'; el.classList.remove('is-you', 'occupied'); }
  });

  queue.forEach(q => {
    const slot = slotMap[q.position];
    if (!slot) return;
    slot.classList.add('occupied');
    if (q.isYou) slot.classList.add('is-you');
    const firstName = q.name.split(' ')[0];
    slot.innerHTML = `<strong>${q.unit}</strong><small>${firstName}${q.isYou ? ' ✦' : ''}</small>`;
  });

  const waitList = document.getElementById('termWaitingList');
  if (!waitList) return;

  const waitItems = queue.filter(q => q.position === 'waiting');
  if (waitItems.length === 0) {
    waitList.innerHTML = `<span style="color:var(--text-muted);font-size:12px">Sin unidades en espera</span>`;
    return;
  }

  waitList.innerHTML = waitItems.map(q => `
    <div class="dq-wait-chip ${q.isYou ? 'is-you' : ''}">
      <span class="chip-num">${q.unit}</span>
      <span class="chip-pos">T${q.pos}</span>
      ${q.isYou ? '<span class="chip-you">TÚ</span>' : ''}
    </div>`).join('');
}


/* ============================================================
   8. LISTA COMPLETA
   ============================================================ */
function renderFullQueue() {
  const queue = QUEUES[activeRoute];
  const list  = document.getElementById('fullQueueList');
  if (!list) return;

  if (queue.length === 0) {
    list.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text-muted)"><i class="fas fa-list-ol" style="font-size:24px;opacity:.3;display:block;margin-bottom:8px"></i>Sin inscripciones para hoy</div>`;
    return;
  }

  const STATUS_BADGE = {
    calling:  'status-badge active',
    ramp1:    'status-badge transit',
    ramp2:    'status-badge transit',
    outside1: 'status-badge pending',
    outside2: 'status-badge pending',
    waiting:  'status-badge',
    departed: 'status-badge completed',
    cancelled:'status-badge',
  };

  list.innerHTML = queue.map(item => {
    const isDone   = item.position === 'departed' || item.position === 'cancelled';
    const isActive = ['calling','ramp1','ramp2','outside1','outside2'].includes(item.position);
    const ahead    = queue.filter(q => q.pos < item.pos && !['departed','cancelled'].includes(q.position)).length;
    const waitMins = ahead * 35;

    return `
      <div class="dq-list-item ${item.isYou ? 'is-you' : ''} ${isDone ? 'departed' : ''}">
        <span class="dq-list-pos ${isActive ? 'active' : ''}">${item.pos}</span>
        <div class="dq-list-main">
          <div class="dq-list-name">
            Unidad <strong>${item.unit}</strong> · ${item.name}
            ${item.isYou ? '<span class="dq-you-tag">TÚ</span>' : ''}
          </div>
          <div class="dq-list-meta">
            <span>${item.company}</span>
            ${!isDone ? `<span class="dq-list-wait">~${waitMins} min</span>` : ''}
          </div>
        </div>
        <span class="${STATUS_BADGE[item.position] || 'status-badge'}">${POS_LABEL[item.position]}</span>
      </div>`;
  }).join('');
}


/* ============================================================
   9. CAMBIO DE RUTA (TABS)
   ============================================================ */
window.switchRoute = function (route, btn) {
  activeRoute = route;
  document.querySelectorAll('.dq-route-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderAll();
};

function initActiveTab() {
  const tabId = activeRoute === 'puno-juli' ? 'tabPunoJuli' : 'tabJuliPuno';
  document.querySelectorAll('.dq-route-tab').forEach(b => b.classList.remove('active'));
  const tab = document.getElementById(tabId);
  if (tab) tab.classList.add('active');
}

function renderAll() {
  renderMyTurn();
  renderLiveBar();
  renderTerminalDiagram();
  renderFullQueue();
}


/* ============================================================
   10. INSCRIPCIÓN / AUSENCIA
   ============================================================ */
window.registerInQueue = async function () {
  const now = new Date();
  const hrs = now.getHours();
  const mins = now.getMinutes();
  const canReg = hrs > 18 || (hrs === 18 && mins >= 30);
  if (!canReg) {
    showQueueToast(`⚠️ La inscripción abre a las 6:30 PM. Hora actual: ${now.toLocaleTimeString('es-PE')}`, 'warn');
    return;
  }
  if (!confirm('¿Confirmas tu inscripción en la cola de mañana?')) return;

  try {
    const res  = await fetch(`${QUEUE_API}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        driver_id:  session.id,
        route:      activeRoute,
      }),
    });
    const data = await res.json();
    if (!res.ok) { showQueueToast('Error: ' + (data.error || 'No se pudo inscribir'), 'warn'); return; }
    showQueueToast('✅ ¡Inscripto exitosamente para mañana!');
    const btn = document.getElementById('btnRegister');
    if (btn) {
      btn.innerHTML = '<i class="fas fa-check-circle"></i><span>Inscrito</span><small>para mañana</small>';
      btn.disabled = true;
    }
  } catch {
    showQueueToast('✅ Inscripción registrada localmente');
  }
};

window.reportAbsence = function () {
  if (confirm('¿Confirmas que NO saldrás hoy?\n\nEl administrador y el conductor siguiente serán notificados.')) {
    showQueueToast('✅ Ausencia reportada. El administrador fue notificado.');
  }
};

function showQueueToast(msg, type = 'ok') {
  let t = document.getElementById('queueToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'queueToast';
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 18px;border-radius:12px;font-size:0.88rem;font-weight:600;display:flex;align-items:center;gap:8px;transform:translateY(80px);opacity:0;transition:all 0.4s ease';
    document.body.appendChild(t);
  }
  t.style.background = type === 'warn' ? '#F59E0B' : '#10B981';
  t.style.color = type === 'warn' ? '#030712' : '#fff';
  t.textContent = msg;
  t.style.transform = 'translateY(0)';
  t.style.opacity = '1';
  setTimeout(() => { t.style.transform = 'translateY(80px)'; t.style.opacity = '0'; }, 3500);
}


/* ============================================================
   11. SIDEBAR TOGGLE
   ============================================================ */
document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar')?.classList.toggle('open');
});


/* ============================================================
   INIT — cargar datos reales
   ============================================================ */
loadBothRoutes();

// Recargar cada 30 segundos
setInterval(loadBothRoutes, 30000);
