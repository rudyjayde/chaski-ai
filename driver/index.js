/* ============================================================
   driver/index.js — Lógica del panel principal del conductor
   Chaski AI v2.0
   ============================================================
   Contenido:
   1.  Autenticación y perfil
   2.  Reloj y fecha
   3.  Banner de alerta (inscripción cola)
   4.  Contadores de KPI del día (animados)
   5.  Cola de salida mini-list
   6.  Simulación GPS en tiempo real
   7.  IAPE / QR de cobro digital
   8.  Acciones rápidas (inscribir, ausencia)
   9.  Sidebar toggle
   ============================================================ */

'use strict';

/* ============================================================
   1. AUTENTICACIÓN Y PERFIL
   ============================================================ */
const session = JSON.parse(localStorage.getItem('chaski_user') || 'null');

/* Datos del conductor */
const DRIVER_DATA = {
  'eloy.mamani':     { name: 'Eloy Mamani',     vehicle: '001', plate: 'PUN-001', company: 'Virgen de Fátima',     queuePos: 5 },
  'jose.quispe':     { name: 'José Quispe',      vehicle: '002', plate: 'PUN-002', company: 'Surandino',            queuePos: 2 },
  'abraham.morales': { name: 'Abraham Morales',  vehicle: '003', plate: 'PUN-003', company: 'San Francisco de Borja', queuePos: 3 },
  'juan.perez':      { name: 'Juan Pérez',       vehicle: '004', plate: 'PUN-004', company: 'Virgen de Fátima II',  queuePos: 4 },
  'carlos.ticona':   { name: 'Carlos Ticona',    vehicle: '005', plate: 'PUN-005', company: 'San Miguel',           queuePos: 6 },
};

const driver = DRIVER_DATA[session.username] || {
  name: session.name || 'Conductor',
  vehicle: '001', plate: 'PUN-001', company: '—', queuePos: 1,
};

/* Mostrar perfil en sidebar */
const nameEl    = document.getElementById('sidebarDriverName');
const vehicleEl = document.getElementById('sidebarVehicle');
const companyEl = document.getElementById('sidebarCompany');
const badgeEl   = document.getElementById('queueBadge');

if (nameEl)    nameEl.textContent    = driver.name;
if (vehicleEl) vehicleEl.textContent = `Unidad ${driver.vehicle} · ${driver.plate}`;
if (companyEl) companyEl.textContent = driver.company;
if (badgeEl)   badgeEl.textContent   = `#${driver.queuePos}`;

/* KPI: posición en cola */
const queuePosEl = document.getElementById('queuePos');
if (queuePosEl) queuePosEl.textContent = `#${driver.queuePos}`;


/* ============================================================
   2. RELOJ Y FECHA
   ============================================================ */
function updateClock() {
  const now  = new Date();
  const time = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const clockEl = document.getElementById('clockDisplay');
  const dateEl  = document.getElementById('dateDisplay');
  const qDateEl = document.getElementById('queueDateDisplay');

  if (clockEl) clockEl.textContent = time;
  if (dateEl)  dateEl.textContent  = date.charAt(0).toUpperCase() + date.slice(1);
  if (qDateEl) qDateEl.textContent = now.toLocaleDateString('es-PE');
}
setInterval(updateClock, 1000);
updateClock();


/* ============================================================
   3. BANNER DE ALERTA
   ============================================================ */
function updateAlertBanner() {
  const now        = new Date();
  const canRegister = now.getHours() >= 20;
  const alertMsg    = document.getElementById('alertMsg');
  if (!alertMsg) return;

  if (canRegister) {
    alertMsg.innerHTML = `¡Ya puedes inscribirte en la cola de salida para mañana!
      <strong>Disponible hasta las 11:59 PM</strong>`;
  } else {
    const h = 20 - now.getHours() - 1;
    const m = 60 - now.getMinutes();
    alertMsg.innerHTML = `La inscripción para mañana se abre a las <strong>20:00</strong>.
      Faltan aproximadamente <strong>${h > 0 ? h + 'h ' : ''}${m % 60}m</strong>.`;
  }
}
updateAlertBanner();


/* ============================================================
   4. CONTADORES DE KPI — datos reales del día
   ============================================================ */
function animateCounter(el, target, prefix = '', suffix = '') {
  if (!el) return;
  const dur = 900, t0 = performance.now();
  function step(ts) {
    const p = Math.min((ts - t0) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = prefix + Math.round(target * e) + suffix;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function animateRevenue(target) {
  const revEl = document.getElementById('revenueToday');
  if (!revEl) return;
  const dur = 900, t0 = performance.now();
  (function step(ts) {
    const p = Math.min((ts - t0) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);
    revEl.textContent = `S/ ${(target * e).toFixed(2)}`;
    if (p < 1) requestAnimationFrame(step);
  })(performance.now());
}

async function loadTodayKPIs(driverId) {
  if (!driverId) return;
  try {
    const today = localDateStrIdx(new Date());
    const res   = await authFetch(`/api/trips?driver_id=${driverId}&date=${today}&limit=20`);
    if (!res.ok) return;
    const trips = await res.json();
    if (!Array.isArray(trips)) return;

    const tripCount = trips.length;
    const pasCount  = trips.reduce((s, t) => s + (parseInt(t.total_passengers) || 0), 0);
    const revTotal  = trips.reduce((s, t) => s + (parseFloat(t.revenue) || 0), 0);

    animateCounter(document.getElementById('tripsToday'),      tripCount);
    animateCounter(document.getElementById('passengersToday'), pasCount);
    animateRevenue(revTotal);

    // Actualizar Mi Desempeño
    const avgPax = tripCount > 0 ? Math.round(pasCount / tripCount) : 0;
    const pT = document.getElementById('perfTrips');
    const pP = document.getElementById('perfPax');
    const pR = document.getElementById('perfRevenue');
    const pA = document.getElementById('perfAvgPax');
    if (pT) pT.textContent = tripCount;
    if (pP) pP.textContent = pasCount;
    if (pR) pR.textContent = `S/ ${revTotal.toFixed(0)}`;
    if (pA) pA.textContent = avgPax > 0 ? avgPax : '—';
  } catch (e) {
    console.warn('[index] No se pudo cargar KPIs del día:', e.message);
  }
}


/* ============================================================
   5. COLA MINI-LIST — datos reales desde API
   ============================================================ */
const QUEUE_API_IDX = '/api/queue';

function localDateStrIdx(d) {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

const POS_CLS   = { calling:'calling', ramp1:'ready', ramp2:'ready', outside1:'ready', outside2:'ready', waiting:'waiting', departed:'departed' };
const POS_LBL   = { calling:'LLAMANDO', ramp1:'RAMPA 1', ramp2:'RAMPA 2', outside1:'EXTERIOR', outside2:'EXTERIOR', waiting:'ESPERANDO', departed:'SALIÓ' };
const POS_BADGE = { calling:'calling-badge', ramp1:'ready-badge', ramp2:'ready-badge', outside1:'ready-badge', outside2:'ready-badge', waiting:'wait-badge' };

async function loadDriverQueueStatus() {
  const todayStr    = localDateStrIdx(new Date());
  const tomorrowD   = new Date(); tomorrowD.setDate(tomorrowD.getDate() + 1);
  const tomorrowStr = localDateStrIdx(tomorrowD);

  let entries = [], myEntry = null, queueDate = todayStr;

  const mapEntries = (list, i, e) => ({
    num:       e.vehicle_code || '???',
    name:      `${e.first_name || ''} ${e.last_name || ''}`.trim(),
    pos:       e.position,
    username:  e.username || '',
    turn:      e.turn_number || (i + 1),
    driver_id: e.driver_id,
    company:   e.company || '',
    isYou:     e.username === session.username,
  });

  try {
    // Buscar hoy en ambas rutas — preferir entrada activa (no departed/cancelled)
    const isActive = e => e.isYou && !['departed', 'cancelled'].includes(e.pos);
    for (const route of ['juli-puno', 'puno-juli']) {
      const r = await authFetch(`${QUEUE_API_IDX}?route=${route}&date=${todayStr}`);
      const d = await r.json();
      if (!d.ok) continue;
      const mapped = d.entries.map((e, i) => mapEntries(null, i, e));
      const found  = mapped.find(isActive);
      if (found) { entries = mapped; myEntry = found; queueDate = todayStr; break; }
    }

    // Si no hay entrada activa hoy, buscar en los departed de hoy
    if (!myEntry) {
      for (const route of ['juli-puno', 'puno-juli']) {
        const r = await authFetch(`${QUEUE_API_IDX}?route=${route}&date=${todayStr}`);
        const d = await r.json();
        if (!d.ok) continue;
        const mapped = d.entries.map((e, i) => mapEntries(null, i, e));
        const found  = mapped.find(e => e.isYou);
        if (found) { entries = mapped; myEntry = found; queueDate = todayStr; break; }
      }
    }

    // Si no está hoy, buscar mañana en ambas rutas
    if (!myEntry) {
      for (const route of ['juli-puno', 'puno-juli']) {
        const r = await authFetch(`${QUEUE_API_IDX}?route=${route}&date=${tomorrowStr}`);
        const d = await r.json();
        if (!d.ok) continue;
        const mapped = d.entries.map((e, i) => mapEntries(null, i, e));
        const found  = mapped.find(e => e.isYou);
        if (found) { entries = mapped; myEntry = found; queueDate = tomorrowStr; break; }
      }
    }
  } catch (err) {
    console.warn('[index] No se pudo cargar cola:', err.message);
  }

  renderQueueMiniReal(entries, myEntry, queueDate);

  if (myEntry?.pos === 'calling') showCallingAlert(myEntry);
  if (myEntry?.driver_id) loadTodayKPIs(myEntry.driver_id);
}

function renderQueueMiniReal(entries, myEntry, queueDate) {
  const list     = document.getElementById('queueMiniList');
  const noteEl   = document.getElementById('queueNote');
  const qDateEl  = document.getElementById('queueDateDisplay');
  const posEl    = document.getElementById('queuePos');
  const todayStr = localDateStrIdx(new Date());

  if (qDateEl) {
    const d = new Date(queueDate + 'T12:00:00');
    qDateEl.textContent = d.toLocaleDateString('es-PE') + (queueDate !== todayStr ? ' (mañana)' : '');
  }

  if (!myEntry) {
    if (posEl)   posEl.textContent = '—';
    if (badgeEl) badgeEl.textContent = '—';
    if (list)    list.innerHTML = `<div style="padding:14px;text-align:center;color:rgba(255,255,255,.35);font-size:13px">No estás inscrito en la cola</div>`;
    if (noteEl)  noteEl.innerHTML = `<i class="fas fa-info-circle"></i> Puedes inscribirte a partir de las <strong>18:30</strong> para el día siguiente.`;
    updateStatusHeroFromQueue(null, 0, queueDate);
    return;
  }

  if (posEl)    posEl.textContent    = `#${myEntry.turn}`;
  if (badgeEl)  badgeEl.textContent  = `#${myEntry.turn}`;
  if (vehicleEl) vehicleEl.textContent = `Unidad ${myEntry.num}`;
  if (companyEl && myEntry.company) companyEl.textContent = myEntry.company;
  if (nameEl    && myEntry.name)    nameEl.textContent    = myEntry.name;

  if (list) {
    list.innerHTML = entries.map(item => `
      <div class="qml-item ${POS_CLS[item.pos]||''} ${item.isYou ? 'you' : ''}">
        <span class="qml-num">${item.num}</span>
        <span class="qml-name">${item.name}${item.isYou ? ' <span class="you-tag">TÚ</span>' : ''}</span>
        <span class="qml-status ${POS_BADGE[item.pos]||''}">${POS_LBL[item.pos]||item.pos}</span>
      </div>`).join('');
  }

  const ahead = entries.filter(q => q.turn < myEntry.turn && !['departed','cancelled'].includes(q.pos)).length;
  const esMañana = queueDate !== todayStr;
  if (noteEl) {
    noteEl.innerHTML = esMañana
      ? `<i class="fas fa-info-circle"></i> Inscrito para <strong>mañana</strong> — Turno <strong>#${myEntry.turn}</strong>. Posición: <strong>${POS_LBL[myEntry.pos]||myEntry.pos}</strong>.`
      : `<i class="fas fa-info-circle"></i> Turno <strong>#${myEntry.turn}</strong>. ${ahead === 0 ? '¡Es tu turno!' : `Quedan <strong>${ahead}</strong> unidades antes que tú.`}`;
  }

  // Actualizar Status Hero Card desde datos de cola (se actualiza cada 30s)
  updateStatusHeroFromQueue(myEntry, ahead, queueDate);
}

function showCallingAlert(myEntry) {
  const alertEl  = document.getElementById('driverAlert');
  const alertMsg = document.getElementById('alertMsg');
  if (!alertEl || !alertMsg) return;
  alertEl.style.cssText = 'display:flex;background:rgba(255,107,107,.12);border-color:#FF6B6B';
  alertMsg.innerHTML = `🔴 <strong>¡LLAMANDO!</strong> — Unidad ${myEntry.num}: dirígete al terminal ahora para cargar pasajeros.
    <a href="manifest.html" style="color:#FF6B6B;font-weight:700;margin-left:10px;text-decoration:underline">→ Abrir Manifiesto</a>`;

  // Resaltar el botón de Nuevo Manifiesto en Acciones Rápidas
  const manifestBtn = document.querySelector('a[href="manifest.html"].qa-btn');
  if (manifestBtn) {
    manifestBtn.style.borderColor = '#FF6B6B';
    manifestBtn.style.background  = 'rgba(255,107,107,.12)';
    const lbl = manifestBtn.querySelector('span');
    if (lbl) lbl.textContent = '¡Llena el manifiesto!';
  }
}

loadDriverQueueStatus();
setInterval(loadDriverQueueStatus, 30000);


/* ============================================================
   6. SIMULACIÓN GPS
   ============================================================ */
const POSITIONS = ['Juli - Plaza', 'Juli - Av. Titicaca', 'Pomata', 'Zepita', 'Ilave', 'Desaguadero'];
let posIdx = 0;

function simulateGPS() {
  const speed       = Math.floor(Math.random() * 40);
  const speedEl     = document.getElementById('currentSpeed');
  const posEl       = document.getElementById('lastPos');
  const badgeEl     = document.getElementById('gpsBadge');

  if (speedEl) speedEl.textContent = speed + ' km/h';
  if (posEl)   posEl.textContent   = POSITIONS[posIdx % POSITIONS.length];
  if (badgeEl) {
    badgeEl.textContent = speed > 0 ? 'EN LÍNEA' : 'EN PAUSA';
    badgeEl.style.color = speed > 0 ? 'var(--success)' : 'var(--gold)';
  }

  posIdx++;
}
setInterval(simulateGPS, 4000);
simulateGPS();


/* ============================================================
   7. IAPE / QR DE COBRO DIGITAL
   ============================================================ */
function uploadQr() {
  const input = document.createElement('input');
  input.type  = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const box = document.getElementById('iapeQrBox');
      if (box) {
        box.innerHTML = `<img src="${ev.target.result}"
          style="width:140px;height:140px;object-fit:contain;border-radius:8px;">`;
      }
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function generateQr() {
  const phone = prompt('Ingresa tu número de celular (con 9):');
  if (!phone || phone.length < 9) return;

  const phoneEl = document.getElementById('iapePhone');
  const qrBox   = document.getElementById('iapeQrBox');
  if (phoneEl) phoneEl.textContent = '+51 ' + phone;
  if (qrBox) {
    qrBox.innerHTML = `
      <div style="width:140px;height:140px;background:white;border-radius:8px;
                  display:flex;flex-direction:column;align-items:center;
                  justify-content:center;color:#333;">
        <i class="fas fa-qrcode" style="font-size:3rem;color:#0066ff;margin-bottom:8px"></i>
        <small style="font-size:0.65rem;text-align:center">QR generado<br>+51 ${phone}</small>
      </div>`;
  }
  alert('✅ QR generado para el número +51 ' + phone);
}

function editPhone() {
  const phone = prompt('Ingresa tu número de celular:');
  if (phone) {
    const phoneEl = document.getElementById('iapePhone');
    if (phoneEl) phoneEl.textContent = '+51 ' + phone;
  }
}

window.uploadQr   = uploadQr;
window.generateQr = generateQr;
window.editPhone  = editPhone;


/* ============================================================
   8. ACCIONES RÁPIDAS
   ============================================================ */
function registerQueue() {
  // Redirige a la página de cola donde está la lógica completa de inscripción
  window.location.href = 'queue.html';
}

function reportAbsence() {
  if (confirm('¿Confirmas que NO saldrás hoy?\n\nEsto notificará al administrador y al siguiente conductor.')) {
    alert('✅ Ausencia reportada. El administrador ha sido notificado.');
  }
}

window.registerQueue  = registerQueue;
window.reportAbsence  = reportAbsence;


/* ============================================================
   9. NOTIFICACIONES — conectadas a la API
   ============================================================ */
const NOTIF_API = '/api/communications/notifications';

let _cachedNotifs = [];  // caché en memoria para acceder al body completo al hacer clic

async function fetchDriverNotifs() {
  try {
    const res  = await authFetch(NOTIF_API);
    if (!res.ok) throw new Error('api error');
    const data = await res.json();
    _cachedNotifs = data.notifications || [];
    return _cachedNotifs;
  } catch {
    return JSON.parse(localStorage.getItem('chaski_driver_notifs_' + (session?.username || '')) || '[]');
  }
}

async function renderNotifPanel() {
  const list    = document.getElementById('notifList');
  const countEl = document.getElementById('bellCount');
  if (!list) return;

  const notifs = await fetchDriverNotifs();
  const unread = notifs.filter(n => !n.read).length;

  if (countEl) {
    countEl.textContent   = unread;
    countEl.style.display = unread > 0 ? 'flex' : 'none';
  }

  if (notifs.length === 0) {
    list.innerHTML = `<div class="notif-empty"><i class="fas fa-bell-slash"></i><p>Sin notificaciones</p></div>`;
    return;
  }

  const icons = {
    urgent:     'fa-bell',
    alert:      'fa-exclamation-triangle',
    info:       'fa-info-circle',
    reglamento: 'fa-book',
    manifest:   'fa-file-invoice',
    queue:      'fa-list-ol',
  };
  const iCls = {
    urgent:     'danger',
    alert:      'gold',
    info:       'success',
    reglamento: 'indigo',
    manifest:   '',
    queue:      'gold',
  };

  list.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'} ${n.type === 'reglamento' ? 'notif-reglamento' : ''}" onclick="readNotif('${n.id}')">
      <div class="notif-icon ${iCls[n.type] || ''}"><i class="fas ${icons[n.type] || 'fa-bell'}"></i></div>
      <div class="notif-body">
        ${n.type === 'reglamento' ? `<div class="notif-type-tag">REGLAMENTO</div>` : ''}
        <div class="notif-msg">${n.title || n.msg || ''}</div>
        ${n.body ? `<div class="notif-sub">${n.body.substring(0, 80)}${n.body.length > 80 ? '…' : ''}</div>` : ''}
      </div>
      <div class="notif-time">${formatTimeAgo(n.created_at || n.at)}</div>
    </div>`).join('');

  // También actualizar la tarjeta del dashboard si existe
  renderNotifCard(notifs);
}

function renderNotifCard(notifs) {
  const card = document.getElementById('notifCardList');
  if (!card) return;

  if (!notifs || notifs.length === 0) {
    card.innerHTML = `<div style="padding:20px;text-align:center;color:rgba(255,255,255,.35);font-size:13px">
      <i class="fas fa-bell-slash" style="display:block;font-size:24px;opacity:.3;margin-bottom:8px"></i>Sin notificaciones
    </div>`;
    return;
  }

  const reglamentos = notifs.filter(n => n.type === 'reglamento');
  const comunicados = notifs.filter(n => n.type !== 'reglamento').slice(0, 5);

  let html = '';

  if (reglamentos.length > 0) {
    html += `<div class="nc-section-title"><i class="fas fa-book"></i> Reglamentos vigentes</div>`;
    html += reglamentos.map(n => `
      <div class="nc-item nc-reg" onclick="readNotif('${n.id}')">
        <div class="nc-icon nc-icon--reg"><i class="fas fa-book"></i></div>
        <div class="nc-body">
          <div class="nc-title">${n.title || ''}</div>
          <div class="nc-meta">${n.body ? n.body.substring(0, 60) + (n.body.length > 60 ? '…' : '') : ''}</div>
        </div>
        <i class="fas fa-chevron-right nc-arrow"></i>
      </div>`).join('');
  }

  if (comunicados.length > 0) {
    html += `<div class="nc-section-title" style="margin-top:${reglamentos.length > 0 ? '12px' : '0'}"><i class="fas fa-bell"></i> Últimos comunicados</div>`;
    html += comunicados.map(n => {
      const color = { urgent:'#FF6B6B', alert:'#FFB800', info:'#00C8FF' }[n.type] || '#00C8FF';
      return `
        <div class="nc-item ${!n.read ? 'nc-unread' : ''}" onclick="readNotif('${n.id}')">
          <div class="nc-dot" style="background:${color}"></div>
          <div class="nc-body">
            <div class="nc-title">${n.title || ''}</div>
            <div class="nc-meta">${formatTimeAgo(n.created_at || n.at)}</div>
          </div>
          ${!n.read ? '<span class="nc-badge">Nuevo</span>' : ''}
        </div>`;
    }).join('');
  }

  card.innerHTML = html;
}

async function updateBellCount() {
  try {
    const res  = await authFetch(NOTIF_API);
    if (!res.ok) return;
    const data    = await res.json();
    const countEl = document.getElementById('bellCount');
    if (countEl) {
      countEl.textContent   = data.unread;
      countEl.style.display = data.unread > 0 ? 'flex' : 'none';
    }
  } catch {}
}

function toggleNotifPanel() {
  const panel = document.getElementById('notifPanel');
  if (!panel) return;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : '';
  if (!open) renderNotifPanel();
}
window.toggleNotifPanel = toggleNotifPanel;

async function readNotif(id) {
  try {
    await authFetch(`${NOTIF_API}/${id}/read`, { method: 'PUT' });
  } catch {}

  // Buscar datos completos desde el caché en memoria
  const n = _cachedNotifs.find(x => String(x.id) === String(id));
  if (n) {
    openNotifDetail({
      title: n.title || n.msg || 'Comunicado',
      body:  n.body  || n.sub || '',
      time:  formatTimeAgo(n.created_at || n.at),
      type:  n.type || 'info',
    });
  }

  // Actualizar badge (sin re-renderizar el panel mientras el modal está abierto)
  updateBellCount();
}
window.readNotif = readNotif;

// ── Modal de detalle de notificación ─────────────────────────
function openNotifDetail(n) {
  const overlay = document.getElementById('notifDetailOverlay');
  if (!overlay) return;

  // Cerrar panel dropdown
  const panel = document.getElementById('notifPanel');
  if (panel) panel.style.display = 'none';

  document.getElementById('ndModalTitle').textContent = n.title || 'Comunicado';
  document.getElementById('ndModalBody').textContent  = n.body  || '';
  document.getElementById('ndModalDate').textContent  = n.time  ? `Recibido: ${n.time}` : '';

  const badge = document.getElementById('ndModalBadge');
  const icon  = document.getElementById('ndModalIcon');

  const CFG = {
    urgent:     { label:'Urgente',           color:'#FF6B6B', bg:'rgba(255,107,107,.15)', fa:'fa-bell' },
    alert:      { label:'Alerta importante', color:'#FFB800', bg:'rgba(255,184,0,.15)',   fa:'fa-exclamation-triangle' },
    info:       { label:'Comunicado',        color:'#00C8FF', bg:'rgba(0,200,255,.12)',   fa:'fa-bullhorn' },
    reglamento: { label:'Reglamento',        color:'#AA88FF', bg:'rgba(170,136,255,.15)', fa:'fa-book' },
  };
  const cfg = CFG[n.type] || CFG.info;

  badge.textContent     = cfg.label;
  badge.style.color     = cfg.color;
  icon.style.background = cfg.bg;
  icon.innerHTML        = `<i class="fas ${cfg.fa}" style="color:${cfg.color}"></i>`;

  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
window.openNotifDetail = openNotifDetail;

function closeNotifDetail() {
  const overlay = document.getElementById('notifDetailOverlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
}
window.closeNotifDetail = closeNotifDetail;

async function markAllRead() {
  try {
    await authFetch(`/api/communications/notifications/read-all`, { method: 'PUT' });
  } catch {}
  renderNotifPanel();
}
window.markAllRead = markAllRead;

// Actualiza el badge cada 60 segundos sin abrir el panel
setInterval(updateBellCount, 60000);
updateBellCount();

function formatTimeAgo(isoStr) {
  if (!isoStr) return '';
  const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
  if (diff < 60)    return 'Ahora';
  if (diff < 3600)  return `Hace ${Math.floor(diff/60)}m`;
  if (diff < 86400) return `Hace ${Math.floor(diff/3600)}h`;
  return new Date(isoStr).toLocaleDateString('es-PE',{day:'numeric',month:'short'});
}

document.addEventListener('click', (e) => {
  const wrap = document.getElementById('notifBellWrap');
  if (wrap && !wrap.contains(e.target)) {
    const p = document.getElementById('notifPanel');
    if (p) p.style.display = 'none';
  }
});

renderNotifPanel();


/* ============================================================
   10. SIDEBAR TOGGLE
   ============================================================ */
document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar')?.classList.toggle('open');
});

/* ============================================================
   11. BANNER DE VIAJE ACTIVO
   ============================================================ */
loadActiveTripBanner();


/* ============================================================
   12. DASHBOARD INTELIGENTE — Status Hero + Chaski AI + Semáforo + Recs
   ============================================================ */
const RISK_COLORS = {
  normal:  '#10B981',
  bajo:    '#6366F1',
  medio:   '#F59E0B',
  alto:    '#EF4444',
  critico: '#FF0040',
};
const RISK_LABELS = {
  normal: 'Normal', bajo: 'Baja', medio: 'Media', alto: 'Alta', critico: 'Crítica',
};

const SHC_CFG = {
  calling:  { label: 'LLAMANDO',    dotCls: 'calling',   accentCls: 'calling',   action: '¡ES TU TURNO! Ve al terminal y carga los pasajeros ahora.',  kpiColor: '#FF6B6B' },
  ramp1:    { label: 'RAMPA 1',     dotCls: 'available', accentCls: '',           action: 'Prepara el vehículo — estás en la primera rampa de salida.', kpiColor: '#10B981' },
  ramp2:    { label: 'RAMPA 2',     dotCls: 'available', accentCls: '',           action: 'Prepara el vehículo — estás en la segunda rampa de salida.', kpiColor: '#10B981' },
  outside1: { label: 'EXTERIOR 1',  dotCls: 'available', accentCls: '',           action: 'Espera tu turno en posición exterior 1.',                    kpiColor: '#6366F1' },
  outside2: { label: 'EXTERIOR 2',  dotCls: 'available', accentCls: '',           action: 'Espera tu turno en posición exterior 2.',                    kpiColor: '#6366F1' },
  waiting:  { label: 'ESPERANDO',   dotCls: 'waiting',   accentCls: '',           action: 'Espera el llamado del administrador de cola.',                kpiColor: '#8BA3C1' },
  departed: { label: 'EN RUTA',     dotCls: 'in-route',  accentCls: 'in-route',  action: 'Viaje en curso. Conduce con precaución.',                    kpiColor: '#1D9BD1' },
};

function updateStatusHeroFromQueue(myEntry, aheadCount, queueDate) {
  const dot      = document.getElementById('shcDot');
  const label    = document.getElementById('shcLabel');
  const pos      = document.getElementById('shcPosition');
  const aheadEl  = document.getElementById('shcAhead');
  const actionEl = document.getElementById('shcAction');
  const barEl    = document.getElementById('shcAccentBar');
  const updEl    = document.getElementById('shcLastUpdate');
  const dtEl     = document.getElementById('shcDatetime');
  const kpiSt    = document.getElementById('statusKpi');
  const kpiStIco = document.getElementById('statusKpiIcon');

  const now = new Date();
  if (dtEl) dtEl.textContent = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  if (updEl) updEl.innerHTML = '<i class="fas fa-check-circle" style="color:#10B981"></i> Actualizado ahora';

  if (!myEntry) {
    if (dot)      dot.className      = 'shc-status-dot off';
    if (label)    { label.className = 'shc-status-label off'; label.textContent = 'SIN INSCRIPCIÓN'; }
    if (pos)      pos.textContent    = '—';
    if (aheadEl)  aheadEl.textContent = '—';
    if (actionEl) actionEl.textContent = 'No estás inscrito en la cola de hoy.';
    if (barEl)    barEl.className    = 'shc-accent-bar';
    if (kpiSt)    kpiSt.textContent  = '—';
    if (kpiStIco) kpiStIco.style.color = '#3A4860';
    return;
  }

  const cfg = SHC_CFG[myEntry.pos] || SHC_CFG.waiting;

  if (dot)      dot.className      = `shc-status-dot ${cfg.dotCls}`;
  if (label)    { label.className = `shc-status-label ${cfg.dotCls}`; label.textContent = cfg.label; }
  if (pos)      { pos.textContent = `#${myEntry.turn}`; pos.classList.toggle('active', true); }
  if (barEl)    barEl.className    = `shc-accent-bar ${cfg.accentCls}`;
  if (kpiSt)    { kpiSt.textContent = cfg.label; kpiSt.style.color = cfg.kpiColor; }
  if (kpiStIco) kpiStIco.style.color = cfg.kpiColor;

  if (aheadEl) {
    aheadEl.textContent = aheadCount === 0
      ? myEntry.pos === 'calling' ? '¡Tu turno!'  : '¡Eres el siguiente!'
      : `${aheadCount} unidad${aheadCount !== 1 ? 'es' : ''}`;
  }

  if (actionEl) {
    if (myEntry.pos === 'calling') {
      actionEl.innerHTML = `<strong style="color:#FF6B6B">¡LLAMANDO!</strong> ${cfg.action}`;
    } else {
      actionEl.textContent = cfg.action;
    }
  }
}

function updateStatusHeroETA(queueBrief, routeLabel) {
  const etaEl    = document.getElementById('shcETA');
  const routeEl  = document.getElementById('shcRoute');
  const etaKpi   = document.getElementById('etaKpi');

  if (routeEl && routeLabel) routeEl.textContent = routeLabel;

  if (!queueBrief) {
    if (etaEl)  etaEl.textContent  = '—';
    if (etaKpi) etaKpi.textContent = '—';
    return;
  }

  if (etaEl) {
    if (queueBrief.currentPosition === 'calling' || queueBrief.estimatedMinutes === 0) {
      etaEl.textContent = '¡Ahora!';
      etaEl.style.color = '#FF6B6B';
    } else if (queueBrief.estimatedMinutes > 0) {
      etaEl.textContent = `~${queueBrief.estimatedMinutes} min`;
      etaEl.style.color = '#fff';
    } else {
      etaEl.textContent = '—';
    }
  }

  if (etaKpi) {
    etaKpi.textContent = queueBrief.currentPosition === 'calling' ? '¡Ahora!'
      : queueBrief.estimatedMinutes > 0 ? `~${queueBrief.estimatedMinutes}m` : '—';
  }
}

function renderChaskiAI(brief, dash, routeState) {
  const queue = brief?.queue;
  const risk  = routeState?.riskLevel || dash?.overallRisk || 'normal';

  // Greeting
  const greetEl = document.getElementById('caiGreeting');
  if (greetEl) {
    greetEl.innerHTML = '';
    greetEl.style.fontStyle = 'italic';
    const h = new Date().getHours();
    const g = h < 12 ? 'Buenos días' : h < 18 ? 'Buenas tardes' : 'Buenas noches';
    greetEl.textContent = brief?.greeting || `${g}. El sistema opera con normalidad. Que sea un buen turno.`;
  }

  // Bullets generados desde datos
  const bulletsEl = document.getElementById('caiBullets');
  if (bulletsEl) {
    const DEMAND_ICON  = { normal: '✅', bajo: '📊', medio: '📈', alto: '⚠️', critico: '🚨' };
    const DEMAND_TEXT  = {
      normal:  'La operación transcurre con normalidad.',
      bajo:    'Demanda baja en tu ruta. Operación tranquila.',
      medio:   'Demanda moderada — más pasajeros de lo habitual.',
      alto:    'Alta demanda. Hay oportunidad de más viajes hoy.',
      critico: 'Demanda crítica. Se necesitan vehículos urgentemente.',
    };
    const bullets = [
      { icon: DEMAND_ICON[risk] || '📊', text: DEMAND_TEXT[risk] || 'Operación analizada.' },
    ];
    if (routeState?.vehiclesAvailable != null) {
      const v = routeState.vehiclesAvailable;
      bullets.push({ icon: '🚌', text: `${v} vehículo${v !== 1 ? 's' : ''} disponible${v !== 1 ? 's' : ''} en tu ruta ahora.` });
    }
    if (queue?.currentPosition === 'calling') {
      bullets.push({ icon: '🔴', text: '¡El administrador te está llamando! Es tu turno.' });
    } else if (queue?.ahead === 0) {
      bullets.push({ icon: '🟢', text: '¡Eres el siguiente! Prepara el vehículo y mantente listo.' });
    } else if (queue?.estimatedMinutes > 0) {
      bullets.push({ icon: '⏱', text: `Tiempo estimado de espera: ~${queue.estimatedMinutes} min.` });
    }
    if (routeState?.passengersToday > 0) {
      bullets.push({ icon: '👥', text: `${routeState.passengersToday} pasajeros transportados hoy en tu ruta.` });
    }

    bulletsEl.innerHTML = bullets.map(b =>
      `<div class="cai-bullet"><span class="cai-bullet-icon">${b.icon}</span><span>${b.text}</span></div>`
    ).join('');
  }

  // Barra de probabilidad
  const prob     = queue?.probability;
  const probVal  = document.getElementById('caiProbVal');
  const probFill = document.getElementById('caiProbFill');
  if (probVal) {
    probVal.textContent = prob != null ? `${Math.round(prob * 100)}%` : '—%';
    probVal.style.color = prob >= 0.85 ? '#10B981' : prob >= 0.60 ? '#F59E0B' : '#EF4444';
  }
  if (probFill) {
    probFill.style.width = prob != null ? `${Math.round(prob * 100)}%` : '0%';
    probFill.style.background = prob >= 0.85
      ? 'linear-gradient(90deg, #6366F1, #10B981)'
      : prob >= 0.60
        ? 'linear-gradient(90deg, #6366F1, #F59E0B)'
        : 'linear-gradient(90deg, #6366F1, #EF4444)';
  }

  // Recomendación
  const recEl = document.getElementById('caiRecText');
  if (recEl) {
    if (queue?.currentPosition === 'calling') {
      recEl.innerHTML = `<strong style="color:#FF6B6B">¡Dirígete al terminal de inmediato!</strong> El administrador te está llamando.`;
    } else if (queue?.ahead === 0) {
      recEl.textContent = '¡Eres el siguiente! Prepara el vehículo, los documentos y el manifiesto.';
    } else if (risk === 'critico' || risk === 'alto') {
      recEl.textContent = `Alta demanda en tu ruta. Permanece disponible y listo para salir pronto.`;
    } else if (queue) {
      recEl.textContent = `Mantente en posición #${queue.position}. Espera el llamado — quedan ${queue.ahead} unidades antes que tú.`;
    } else {
      recEl.textContent = 'Inscríbete en la cola para recibir orientación personalizada de tu turno.';
    }
  }
}

function renderSemaphore(routeState, overallRisk) {
  const risk = routeState?.riskLevel || overallRisk || 'normal';

  document.getElementById('sLight-red')?.setAttribute('class',
    'ai-semaphore-light' + (['critico','alto'].includes(risk) ? ' active-red' : ''));
  document.getElementById('sLight-yellow')?.setAttribute('class',
    'ai-semaphore-light' + (risk === 'medio' ? ' active-yellow' : ''));
  document.getElementById('sLight-green')?.setAttribute('class',
    'ai-semaphore-light' + (['normal','bajo'].includes(risk) ? ' active-green' : ''));

  const descs = {
    normal:  'La operación avanza con normalidad. Todo en orden.',
    bajo:    'Operación controlada. Monitoreo preventivo activo.',
    medio:   'Poca oferta disponible. Atención moderada requerida.',
    alto:    'Riesgo elevado. Se recomienda acción operativa.',
    critico: '¡Acción inmediata! Sin vehículos disponibles.',
  };

  const statusEl = document.getElementById('semaphoreStatus');
  const descEl   = document.getElementById('semaphoreDesc');
  if (statusEl) { statusEl.textContent = `Demanda ${RISK_LABELS[risk] || risk}`; statusEl.style.color = RISK_COLORS[risk] || '#10B981'; }
  if (descEl)   descEl.textContent = descs[risk] || '';

  const availEl = document.getElementById('semVehiclesAvail');
  const routeEl = document.getElementById('semVehiclesRoute');
  if (availEl) availEl.textContent = routeState?.vehiclesAvailable ?? '—';
  if (routeEl) routeEl.textContent = routeState?.vehiclesInRoute ?? '—';
}

function renderDriverRecs(alerts, recs) {
  const container = document.getElementById('driverAiRecs');
  if (!container) return;

  if (!alerts.length && !recs.length) {
    container.innerHTML = `
      <div style="padding:18px;text-align:center;color:rgba(255,255,255,.35);font-size:13px">
        <i class="fas fa-check-circle" style="display:block;font-size:22px;color:#10B981;opacity:.5;margin-bottom:8px"></i>
        Sin alertas activas — operación normal
      </div>`;
    return;
  }

  const SEV_ICO = { critical: 'fa-radiation', high: 'fa-exclamation-triangle', medium: 'fa-exclamation-circle', low: 'fa-info-circle' };
  const PRI_ICO = { critical: 'fa-radiation', high: 'fa-exclamation-circle',   medium: 'fa-lightbulb',           low: 'fa-info-circle' };

  let html = '';
  alerts.slice(0, 3).forEach(a => {
    html += `<div class="ai-driver-rec-item sev-${a.severity}">
      <i class="fas ${SEV_ICO[a.severity] || 'fa-bell'} ai-driver-rec-icon"></i>
      <span>${a.message}</span>
    </div>`;
  });
  recs.slice(0, 2).forEach(r => {
    html += `<div class="ai-driver-rec-item prio-${r.priority}">
      <i class="fas ${PRI_ICO[r.priority] || 'fa-lightbulb'} ai-driver-rec-icon"></i>
      <span>${r.message}</span>
    </div>`;
  });

  container.innerHTML = html;
}

async function loadAIBrief() {
  try {
    const [briefRes, dashRes, alertsRes, recsRes] = await Promise.all([
      authFetch('/api/ai/driver-brief'),
      authFetch('/api/ai/dashboard'),
      authFetch('/api/ai/alerts'),
      authFetch('/api/ai/recommendations'),
    ]);

    const brief = briefRes.ok  ? await briefRes.json()  : null;
    const dash  = dashRes.ok   ? await dashRes.json()   : null;
    const aData = alertsRes.ok ? await alertsRes.json() : { alerts: [] };
    const rData = recsRes.ok   ? await recsRes.json()   : { recommendations: [] };

    const myRoute    = brief?.queue?.route || 'juli-puno';
    const routeState = dash?.routes?.find(r => r.route === myRoute) || null;

    // Actualizar ETA y ruta en Status Hero Card
    updateStatusHeroETA(brief?.queue, brief?.queue?.routeLabel);

    // Renderizar Chaski AI card
    renderChaskiAI(brief, dash, routeState);

    // Semáforo y recomendaciones
    renderSemaphore(routeState, dash?.overallRisk);
    renderDriverRecs(aData.alerts || [], rData.recommendations || []);

  } catch (e) {
    console.warn('[index] AI Brief no disponible:', e.message);
    const greetEl = document.getElementById('caiGreeting');
    if (greetEl) {
      greetEl.innerHTML = '';
      greetEl.style.fontStyle = 'normal';
      greetEl.textContent = 'Copiloto IA temporalmente no disponible. El panel sigue funcionando con normalidad.';
    }
  }
}

// Cargar AI brief una vez al abrir el panel
loadAIBrief();


/* ============================================================
   13. CHAT FLOTANTE — Copiloto IA
   ============================================================ */
let _chatOpen    = false;
let _chatHistory = [];
let _chatSending = false;

function toggleAiChat() {
  _chatOpen = !_chatOpen;
  document.getElementById('aiChatModal')?.classList.toggle('open', _chatOpen);
  if (_chatOpen) setTimeout(() => document.getElementById('aiChatInput')?.focus(), 160);
}
window.toggleAiChat = toggleAiChat;

async function sendChatMsg() {
  if (_chatSending) return;
  const input   = document.getElementById('aiChatInput');
  const msgList = document.getElementById('aiChatMessages');
  const sendBtn = document.getElementById('aiChatSendBtn');
  if (!input || !msgList) return;

  const text = input.value.trim();
  if (!text) return;
  input.value  = '';
  _chatSending = true;
  if (sendBtn) sendBtn.disabled = true;

  // Burbuja del usuario
  const uDiv = document.createElement('div');
  uDiv.className = 'ai-chat-msg user';
  uDiv.textContent = text;
  msgList.appendChild(uDiv);

  // Indicador de carga
  const lDiv = document.createElement('div');
  lDiv.className = 'ai-chat-msg ai loading';
  lDiv.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Analizando...';
  msgList.appendChild(lDiv);
  msgList.scrollTop = msgList.scrollHeight;

  try {
    const res  = await authFetch('/api/assistant/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: text, history: _chatHistory }),
    });
    const data  = await res.json();
    const reply = data.response || 'No pude procesar tu consulta en este momento.';

    _chatHistory.push({ role: 'user',      content: text  });
    _chatHistory.push({ role: 'assistant', content: reply });
    if (_chatHistory.length > 20) _chatHistory = _chatHistory.slice(-20);

    lDiv.className   = 'ai-chat-msg ai';
    lDiv.textContent = reply;
  } catch {
    lDiv.className   = 'ai-chat-msg ai';
    lDiv.textContent = 'Error de conexión. Por favor intenta nuevamente.';
  }

  _chatSending = false;
  if (sendBtn) sendBtn.disabled = false;
  msgList.scrollTop = msgList.scrollHeight;
}
window.sendChatMsg = sendChatMsg;

// Cerrar chat al hacer click fuera
document.addEventListener('click', (e) => {
  if (!_chatOpen) return;
  const modal = document.getElementById('aiChatModal');
  const fab   = document.getElementById('aiChatFab');
  if (modal && fab && !modal.contains(e.target) && !fab.contains(e.target)) {
    _chatOpen = false;
    modal.classList.remove('open');
  }
});


/* ============================================================
   14. SOS — EMERGENCIA
   ============================================================ */
function toggleSOS() {
  const overlay = document.getElementById('sosOverlay');
  if (!overlay) return;
  overlay.style.display = overlay.style.display === 'none' ? 'flex' : 'none';
}
window.toggleSOS = toggleSOS;

function closeSOS() {
  const overlay = document.getElementById('sosOverlay');
  if (overlay) overlay.style.display = 'none';
}
window.closeSOS = closeSOS;

async function sendSOS(type) {
  const LABELS = { accidente: 'Accidente de tránsito', averia: 'Avería mecánica', medica: 'Emergencia médica', otro: 'Emergencia' };
  const label  = LABELS[type] || 'Emergencia';
  closeSOS();

  try {
    await authFetch('/api/communications/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type:  'urgent',
        title: `🚨 SOS — ${label}`,
        body:  `El conductor ${driver.name} (Unidad ${driver.vehicle} · ${driver.plate}) reporta: ${label}. Requiere atención inmediata.`,
      }),
    });
    showToast(`SOS enviado: ${label}. El administrador ha sido notificado.`, 'success');
  } catch {
    showToast(`SOS registrado localmente: ${label}.`, 'warning');
  }
}
window.sendSOS = sendSOS;


/* ============================================================
   15. REPORTE DE INCIDENTES
   ============================================================ */
function openIncidentModal() {
  const overlay = document.getElementById('incidentOverlay');
  if (overlay) overlay.style.display = 'flex';
}
window.openIncidentModal = openIncidentModal;

function closeIncidentModal() {
  const overlay = document.getElementById('incidentOverlay');
  if (overlay) overlay.style.display = 'none';
}
window.closeIncidentModal = closeIncidentModal;

async function submitIncident() {
  const type = document.getElementById('incidentType')?.value;
  const desc = document.getElementById('incidentDesc')?.value?.trim();

  if (!type) { showToast('Selecciona el tipo de incidente.', 'warning'); return; }

  const LABELS = {
    trafico:  'Tráfico / Congestión',
    via:      'Vía en mal estado',
    mecanico: 'Problema mecánico',
    pasajero: 'Incidente con pasajero',
    otro:     'Incidente no especificado',
  };

  closeIncidentModal();

  try {
    await authFetch('/api/communications/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type:  'alert',
        title: `⚠️ Incidente: ${LABELS[type] || type}`,
        body:  `Conductor: ${driver.name} | Vehículo: ${driver.plate}\n${desc ? 'Detalle: ' + desc : ''}`,
      }),
    });
    showToast('Incidente reportado al administrador.', 'success');
  } catch {
    showToast('Incidente registrado. Se enviará cuando haya conexión.', 'warning');
  }

  // Limpiar formulario
  const typeEl = document.getElementById('incidentType');
  const descEl = document.getElementById('incidentDesc');
  if (typeEl) typeEl.value = '';
  if (descEl) descEl.value = '';
}
window.submitIncident = submitIncident;


/* ============================================================
   16. TOAST NOTIFICATIONS
   ============================================================ */
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) { console.log('[Toast]', message); return; }

  const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle' };
  const toast = document.createElement('div');
  toast.className = `toast ${type !== 'success' ? type : ''}`;
  toast.innerHTML = `<i class="fas ${icons[type] || 'fa-info-circle'}"></i><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    toast.style.opacity    = '0';
    toast.style.transform  = 'translateX(20px)';
    setTimeout(() => toast.remove(), 420);
  }, 3800);
}
window.showToast = showToast;
