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
if (!session || session.role !== 'driver') {
  window.location.href = '../login.html';
}

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
  const canRegister = now.getHours() >= 18 && now.getMinutes() >= 30;
  const alertMsg    = document.getElementById('alertMsg');
  if (!alertMsg) return;

  if (canRegister) {
    alertMsg.innerHTML = `¡Ya puedes inscribirte en la cola de salida para mañana!
      <strong>Disponible hasta las 11:59 PM</strong>`;
  } else {
    const h = 18 - now.getHours() - (now.getMinutes() >= 30 ? 0 : 1);
    alertMsg.innerHTML = `La inscripción para la cola se abre a las <strong>18:30</strong>.
      Faltan aproximadamente <strong>${h}h ${(30 - now.getMinutes() + 60) % 60}m</strong>.`;
  }
}
updateAlertBanner();


/* ============================================================
   4. CONTADORES DE KPI (simulación)
   ============================================================ */
let tripsToday     = 2;
let passToday      = 28;
let revenueToday   = 196.0;

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

animateCounter(document.getElementById('tripsToday'),     tripsToday);
animateCounter(document.getElementById('passengersToday'), passToday);

const revEl = document.getElementById('revenueToday');
if (revEl) {
  const dur = 900, t0 = performance.now();
  (function step(ts) {
    const p = Math.min((ts - t0) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);
    revEl.textContent = `S/ ${(revenueToday * e).toFixed(2)}`;
    if (p < 1) requestAnimationFrame(step);
  })(performance.now());
}


/* ============================================================
   5. COLA MINI-LIST
   ============================================================ */
const DEMO_QUEUE = [
  { num: '001', name: 'Eloy Mamani',     pos: 'calling',  isYou: session.username === 'eloy.mamani' },
  { num: '002', name: 'José Quispe',     pos: 'ramp',     isYou: session.username === 'jose.quispe' },
  { num: '003', name: 'Abraham Morales', pos: 'ramp',     isYou: session.username === 'abraham.morales' },
  { num: '004', name: 'Juan Pérez',      pos: 'waiting',  isYou: session.username === 'juan.perez' },
  { num: '005', name: 'Carlos Ticona',   pos: 'waiting',  isYou: session.username === 'carlos.ticona' },
  { num: '006', name: 'Roberto Flores',  pos: 'waiting',  isYou: false },
];

const POS_CLASS  = { calling: 'calling', ramp: 'ready',   waiting: 'waiting' };
const POS_LABEL  = { calling: 'LLAMANDO', ramp: 'EN RAMPA', waiting: 'ESPERANDO' };
const BADGE_CLASS = { calling: 'calling-badge', ramp: 'ready-badge', waiting: 'wait-badge' };

function renderQueueMini() {
  const list = document.getElementById('queueMiniList');
  if (!list) return;

  list.innerHTML = DEMO_QUEUE.map(item => `
    <div class="qml-item ${POS_CLASS[item.pos]} ${item.isYou ? 'you' : ''}">
      <span class="qml-num">${item.num}</span>
      <span class="qml-name">
        ${item.name}
        ${item.isYou ? '<span class="you-tag">TÚ</span>' : ''}
      </span>
      <span class="qml-status ${BADGE_CLASS[item.pos]}">${POS_LABEL[item.pos]}</span>
    </div>
  `).join('');

  /* Nota informativa */
  const myEntry  = DEMO_QUEUE.findIndex(q => q.isYou);
  const ahead    = myEntry > 0 ? myEntry : 0;
  const noteEl   = document.getElementById('queueNote');
  if (noteEl && myEntry >= 0) {
    noteEl.innerHTML = `<i class="fas fa-info-circle"></i>
      Quedan <strong>${ahead}</strong> unidades antes de tu turno.
      Mantente cerca del terminal.`;
  }
}
renderQueueMini();


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
  const now         = new Date();
  const canRegister = now.getHours() >= 18 && now.getMinutes() >= 30;
  if (!canRegister) {
    alert(`⚠️ La cola se habilita a partir de las 6:30 PM.\n\nHora actual: ${now.toLocaleTimeString('es-PE')}`);
  } else {
    if (confirm('¿Confirmas inscribirte en la cola de salida para mañana?')) {
      alert('✅ ¡Inscripto exitosamente! Tu turno ha sido asignado.');
    }
  }
}

function reportAbsence() {
  if (confirm('¿Confirmas que NO saldrás hoy?\n\nEsto notificará al administrador y al siguiente conductor.')) {
    alert('✅ Ausencia reportada. El administrador ha sido notificado.');
  }
}

function logout() {
  if (confirm('¿Cerrar sesión?')) {
    localStorage.removeItem('chaski_user');
    window.location.href = '../login.html';
  }
}

window.registerQueue  = registerQueue;
window.reportAbsence  = reportAbsence;
window.logout         = logout;


/* ============================================================
   9. NOTIFICACIONES — conectadas a la API
   ============================================================ */
const NOTIF_API = '/api/communications/notifications';

let _cachedNotifs = [];  // caché en memoria para acceder al body completo al hacer clic

async function fetchDriverNotifs() {
  try {
    const res  = await fetch(NOTIF_API, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    if (!res.ok) throw new Error('api error');
    const data = await res.json();
    _cachedNotifs = data.notifications || [];
    return _cachedNotifs;
  } catch {
    return JSON.parse(localStorage.getItem('chaski_driver_notifs_' + session.username) || '[]');
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
    list.innerHTML = `<div class="notif-empty"><i class="fas fa-bell-slash"></i><p>No tienes notificaciones</p></div>`;
    return;
  }

  const icons = { urgent:'fa-bell', alert:'fa-exclamation-triangle', info:'fa-info-circle', manifest:'fa-file-invoice', queue:'fa-list-ol' };
  const iCls  = { urgent:'danger', alert:'gold', info:'success', manifest:'', queue:'gold' };

  list.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" onclick="readNotif('${n.id}')">
      <div class="notif-icon ${iCls[n.type] || ''}"><i class="fas ${icons[n.type] || 'fa-bell'}"></i></div>
      <div class="notif-body">
        <div class="notif-msg">${n.title || n.msg || ''}</div>
        ${n.body ? `<div class="notif-sub">${n.body}</div>` : (n.sub ? `<div class="notif-sub">${n.sub}</div>` : '')}
      </div>
      <div class="notif-time">${formatTimeAgo(n.created_at || n.at)}</div>
    </div>`).join('');
}

async function updateBellCount() {
  try {
    const res  = await fetch(NOTIF_API, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    if (!res.ok) return;
    const data   = await res.json();
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
  // Marcar como leída en la API
  try {
    await fetch(`${NOTIF_API}/${id}/read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${session.token}` },
    });
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
    urgent: { label:'Urgente',           color:'#FF6B6B', bg:'rgba(255,107,107,.15)', fa:'fa-bell' },
    alert:  { label:'Alerta importante', color:'#FFB800', bg:'rgba(255,184,0,.15)',   fa:'fa-exclamation-triangle' },
    info:   { label:'Comunicado oficial',color:'#00C8FF', bg:'rgba(0,200,255,.12)',   fa:'fa-bullhorn' },
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
    await fetch(`/api/communications/notifications/read-all`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${session.token}` },
    });
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
