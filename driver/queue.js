/* ============================================================
   driver/queue.js — Cola de Salida (datos reales desde API)
   Chaski AI v2.0
   ============================================================ */

'use strict';

const QUEUE_API = '/api/queue';

// Formatea una fecha en YYYY-MM-DD usando la zona horaria local del navegador
function localDateStr(d) {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* ============================================================
   1. AUTENTICACIÓN
   ============================================================ */
const session = JSON.parse(localStorage.getItem('chaski_user') || 'null');

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
let displayDate  = localDateStr(new Date()); // fecha que se está mostrando en la vista

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
async function loadQueueForDate(route, dateStr) {
  try {
    const res  = await authFetch(`${QUEUE_API}?route=${route}&date=${dateStr}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
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
    console.warn('[queue] API no disponible:', err.message);
    return [];
  }
}

async function loadBothRoutes() {
  const todayStr    = localDateStr(new Date());
  const tomorrowD   = new Date();
  tomorrowD.setDate(tomorrowD.getDate() + 1);
  const tomorrowStr = localDateStr(tomorrowD);

  // Cargar cola de hoy
  const [jToday, pToday] = await Promise.all([
    loadQueueForDate('juli-puno', todayStr),
    loadQueueForDate('puno-juli', todayStr),
  ]);

  const inToday = [...jToday, ...pToday].some(e => e.isYou);

  if (inToday) {
    QUEUES['juli-puno'] = jToday;
    QUEUES['puno-juli'] = pToday;
    displayDate = todayStr;
  } else {
    // El conductor puede estar inscrito para mañana — verificar también
    const [jTomorrow, pTomorrow] = await Promise.all([
      loadQueueForDate('juli-puno', tomorrowStr),
      loadQueueForDate('puno-juli', tomorrowStr),
    ]);
    const inTomorrow = [...jTomorrow, ...pTomorrow].some(e => e.isYou);
    QUEUES['juli-puno'] = inTomorrow ? jTomorrow : jToday;
    QUEUES['puno-juli'] = inTomorrow ? pTomorrow : pToday;
    displayDate = inTomorrow ? tomorrowStr : todayStr;
  }

  // Actualizar sidebar con info del conductor
  // Preferir entrada activa (no departed/cancelled) para determinar la ruta activa
  const isActive = e => e.isYou && !['departed', 'cancelled'].includes(e.position);
  const myEntry = [...QUEUES['juli-puno'], ...QUEUES['puno-juli']].find(isActive)
               || [...QUEUES['juli-puno'], ...QUEUES['puno-juli']].find(e => e.isYou);
  if (myEntry) {
    if (vehicleEl) vehicleEl.textContent = `Unidad ${myEntry.unit} · ${myEntry.plate}`;
    if (companyEl) companyEl.textContent = myEntry.company;
    // Priorizar ruta donde el conductor está activo (para que la alerta de LLAMANDO aparezca)
    if (QUEUES['juli-puno'].find(isActive))       activeRoute = 'juli-puno';
    else if (QUEUES['puno-juli'].find(isActive))  activeRoute = 'puno-juli';
    else activeRoute = QUEUES['juli-puno'].find(e => e.isYou) ? 'juli-puno' : 'puno-juli';
    initActiveTab();

    // Marcar botón de inscripción como ya inscrito
    const btn = document.getElementById('btnRegister');
    if (btn && !btn._alreadySet) {
      btn._alreadySet = true;
      const esMañana  = displayDate !== localDateStr(new Date());
      const posLabel  = { calling:'LLAMANDO', ramp1:'Rampa 1', ramp2:'Rampa 2', outside1:'Exterior 1', outside2:'Exterior 2', waiting:'En espera', departed:'En viaje', cancelled:'Cancelado' };
      btn.innerHTML   = `<i class="fas fa-check-circle"></i><span>Inscrito #${myEntry.pos}</span><small>${esMañana ? 'para mañana · ' : ''}${posLabel[myEntry.position] || myEntry.position}</small>`;
      btn.disabled    = true;
      btn.style.background  = 'rgba(16,185,129,.15)';
      btn.style.borderColor = '#10B981';
      btn.style.color       = '#10B981';
    }
  } else {
    if (vehicleEl) vehicleEl.textContent = 'Sin turno inscrito';
  }

  renderAll();
}


/* ============================================================
   5. TARJETA "MI TURNO"
   ============================================================ */
function renderMyTurn() {
  const queue    = QUEUES[activeRoute];
  const myEntry  = queue.find(q => q.isYou);
  const numEl    = document.getElementById('myTurnNum');
  const posEl    = document.getElementById('myTurnPos');
  const waitEl   = document.getElementById('myWaitTime');
  const routeLbl = document.getElementById('myRouteLabel');
  const todayStr = localDateStr(new Date());
  const esMañana = displayDate !== todayStr;

  if (routeLbl) routeLbl.textContent = activeRoute === 'juli-puno' ? 'Juli → Puno' : 'Puno → Juli';

  const callingAlert = document.getElementById('queueCallingAlert');

  const arriveBtn   = document.getElementById('dqArriveBtn');
  const arriveLbl   = document.getElementById('dqArriveBtnLabel');
  const registerBtn = document.getElementById('btnRegister');
  const absentBtn   = document.getElementById('btnAbsent');
  const card        = document.getElementById('myTurnCard');
  const badgeEl     = card?.querySelector('.dq-turn-badge');

  if (myEntry) {
    if (numEl) numEl.textContent = `#${myEntry.pos}`;
    const msgs = {
      calling:  '🔴 ¡Te están llamando! — prepara tu vehículo',
      ramp1:    '🟡 Estás en Rampa 1 — próxima salida',
      ramp2:    '🟡 Estás en Rampa 2 — próxima salida',
      outside1: '🔵 Exterior 1 — espera tu llamado',
      outside2: '🔵 Exterior 2 — espera tu llamado',
      waiting:  esMañana ? '⏳ Inscrito para mañana · En zona de espera' : '⚪ En zona de espera del terminal',
      departed: '🚌 En ruta — viaje en curso',
    };
    if (posEl) posEl.textContent = msgs[myEntry.position] || POS_LABEL[myEntry.position];
    if (callingAlert) callingAlert.style.display = myEntry.position === 'calling' ? 'flex' : 'none';
    if (waitEl) {
      const ahead = queue.filter(q => q.pos < myEntry.pos && q.position !== 'departed' && q.position !== 'cancelled').length;
      waitEl.textContent = myEntry.position === 'departed'
        ? 'Viaje en curso'
        : esMañana && myEntry.position === 'waiting'
          ? 'Para mañana'
          : ahead === 0 ? 'Es tu turno' : `~${ahead * 35} min`;
    }

    if (myEntry.position === 'departed') {
      // Mostrar botón "Llegué a destino"
      const destCity = activeRoute === 'juli-puno' ? 'Puno' : 'Juli';
      if (arriveLbl) arriveLbl.textContent = `Llegué a ${destCity}`;
      if (arriveBtn) arriveBtn.style.display = 'flex';
      if (registerBtn) registerBtn.style.display = 'none';
      if (absentBtn)   absentBtn.style.display   = 'none';
      if (card)        card.classList.add('departed');
      if (badgeEl)     badgeEl.textContent = 'EN RUTA';
    } else {
      if (arriveBtn)   arriveBtn.style.display   = 'none';
      if (registerBtn) registerBtn.style.display = '';
      if (absentBtn)   absentBtn.style.display   = '';
      if (card)        card.classList.remove('departed');
      if (badgeEl)     badgeEl.textContent = 'MI POSICIÓN';
    }
  } else {
    if (numEl) numEl.textContent = '—';
    if (posEl) posEl.textContent = 'No estás inscrito en la cola';
    if (waitEl) waitEl.textContent = '—';
    if (callingAlert) callingAlert.style.display = 'none';
    if (arriveBtn)   arriveBtn.style.display   = 'none';
    if (registerBtn) registerBtn.style.display = '';
    if (absentBtn)   absentBtn.style.display   = '';
    if (card)        card.classList.remove('departed');
    if (badgeEl)     badgeEl.textContent = 'MI POSICIÓN';
  }
}

function handleArriveFromQueue() {
  let tripId = null, revenue = 0;
  try {
    const stored = localStorage.getItem('chaski_active_trip_' + session.username);
    if (stored) {
      const info = JSON.parse(stored);
      tripId  = info.trip_id || null;
      revenue = info.revenue || 0;
    }
  } catch {}
  window.arriveAtDestination(tripId, revenue);
}
window.handleArriveFromQueue = handleArriveFromQueue;

function updateDateLabel() {
  const dateLabel = document.getElementById('queueDateLabel');
  if (!dateLabel) return;
  const d       = new Date(displayDate + 'T12:00:00');
  const todayStr = localDateStr(new Date());
  const suffix   = displayDate !== todayStr ? ' (mañana)' : '';
  dateLabel.textContent = d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }) + suffix;
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
      ${q.isYou
        ? '<span class="chip-you">TÚ</span>'
        : `<span class="chip-pos">T${q.pos}</span>`}
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
    const todayStr = localDateStr(new Date());
    const msg = displayDate !== todayStr ? 'Sin inscripciones para mañana' : 'Sin inscripciones para hoy';
    list.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text-muted)"><i class="fas fa-list-ol" style="font-size:24px;opacity:.3;display:block;margin-bottom:8px"></i>${msg}</div>`;
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
  updateDateLabel();
}


/* ============================================================
   10. INSCRIPCIÓN / AUSENCIA
   ============================================================ */
window.registerInQueue = async function () {
  const now      = new Date();
  const todayStr = localDateStr(now);

  // Verificar si la cola de HOY (para esta ruta) tiene vehículos activos
  let targetDate, targetLabel;
  try {
    const todayRes  = await authFetch(`${QUEUE_API}?route=${activeRoute}&date=${todayStr}`);
    const todayData = await todayRes.json();
    const activeToday = (todayData.entries || []).filter(
      e => !['departed','cancelled'].includes(e.position)
    ).length;

    if (activeToday === 0) {
      // Cola de hoy vacía → inscribir para HOY (sin restricción de horario)
      targetDate  = todayStr;
      targetLabel = 'HOY';
    } else {
      // Cola de hoy tiene vehículos → inscribir para MAÑANA (requiere 20:00)
      const hrs = now.getHours();
      if (hrs < 20) {
        showQueueToast(`⚠️ La inscripción para mañana abre a las 8:00 PM. Hora actual: ${now.toLocaleTimeString('es-PE')}`, 'warn');
        return;
      }
      const tomorrowD = new Date();
      tomorrowD.setDate(tomorrowD.getDate() + 1);
      targetDate  = localDateStr(tomorrowD);
      targetLabel = 'MAÑANA';
    }
  } catch {
    // Si falla la consulta, caer en flujo normal (mañana)
    const tomorrowD = new Date();
    tomorrowD.setDate(tomorrowD.getDate() + 1);
    targetDate  = localDateStr(tomorrowD);
    targetLabel = 'MAÑANA';
  }

  if (!confirm(`¿Confirmas tu inscripción en la cola de ${targetLabel}?\nRuta: ${activeRoute === 'juli-puno' ? 'Juli → Puno' : 'Puno → Juli'}`)) return;

  try {
    const res  = await authFetch(`${QUEUE_API}/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ driver_id: session.id, route: activeRoute, queue_date: targetDate }),
    });
    const data = await res.json();
    if (!res.ok) {
      showQueueToast('Error: ' + (data.error || 'No se pudo inscribir'), 'warn');
      return;
    }

    const turn = data.entry?.turn_number || '?';
    const posLabel = { calling:'LLAMANDO', ramp1:'RAMPA 1', ramp2:'RAMPA 2', outside1:'EXTERIOR 1', outside2:'EXTERIOR 2', waiting:'ESPERA' };
    const posName  = posLabel[data.entry?.position] || 'ESPERA';
    showQueueToast(`✅ Inscripto #${turn} para ${targetLabel.toLowerCase()} — posición inicial: ${posName}`);

    // Actualizar botón
    const btn = document.getElementById('btnRegister');
    if (btn) {
      btn.innerHTML = `<i class="fas fa-check-circle"></i><span>Inscrito #${turn}</span><small>para ${targetLabel.toLowerCase()}</small>`;
      btn.disabled  = true;
      btn.style.background  = 'rgba(16,185,129,.15)';
      btn.style.borderColor = '#10B981';
      btn.style.color       = '#10B981';
    }

    // Recargar la cola para la fecha objetivo y actualizar la vista
    const [jPres, pJRes] = await Promise.all([
      authFetch(`${QUEUE_API}?route=juli-puno&date=${targetDate}`),
      authFetch(`${QUEUE_API}?route=puno-juli&date=${targetDate}`),
    ]);
    const jData = await jPres.json();
    const pData = await pJRes.json();

    const mapEntries = (entries) => (entries || []).map((e, i) => ({
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

    QUEUES['juli-puno'] = mapEntries(jData.entries);
    QUEUES['puno-juli'] = mapEntries(pData.entries);
    displayDate = targetDate;

    renderAll();
  } catch (err) {
    showQueueToast('Error de conexión: ' + err.message, 'warn');
  }
};

window.reportAbsence = async function () {
  // Buscar la entrada del conductor en cualquiera de las dos rutas
  let myEntry = null;
  for (const route of ['juli-puno', 'puno-juli']) {
    const e = QUEUES[route].find(q => q.isYou);
    if (e) { myEntry = e; break; }
  }

  if (!myEntry) {
    showQueueToast('No estás inscrito en ninguna cola hoy.', 'warn');
    return;
  }

  const routeLabel = myEntry.position === 'departed'
    ? 'ya saliste de la cola, pero se marcará tu ausencia para el retorno'
    : `cancelará tu inscripción #${myEntry.pos}`;

  if (!confirm(`¿Confirmas que NO saldrás hoy?\n\nEsto ${routeLabel}.`)) return;

  try {
    const res  = await authFetch(`${QUEUE_API}/${myEntry.id}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) {
      showQueueToast('Error: ' + (data.error || 'No se pudo cancelar'), 'warn');
      return;
    }

    showQueueToast('✅ Inscripción cancelada. Puedes volver a inscribirte cuando quieras.');

    // Rehabilitar botón de inscripción
    const btn = document.getElementById('btnRegister');
    if (btn) {
      btn._alreadySet    = false;
      btn.disabled       = false;
      btn.style.background  = '';
      btn.style.borderColor = '';
      btn.style.color       = '';
      btn.innerHTML = `<i class="fas fa-user-plus"></i><span>Inscribirme</span><small>para hoy</small>`;
    }

    await loadBothRoutes();

  } catch (err) {
    showQueueToast('Error de conexi\xF3n: ' + err.message, 'warn');
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
loadActiveTripBanner();

// Recargar cada 30 segundos
setInterval(loadBothRoutes, 30000);
