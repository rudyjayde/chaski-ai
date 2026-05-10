/* ============================================================
   driver/queue.js — Lógica de la Cola de Salida del conductor
   Chaski AI v2.0
   ============================================================
   Contenido:
   1.  Autenticación y perfil
   2.  Reloj y fecha
   3.  Datos demo de la cola
   4.  Tarjeta "Mi turno"
   5.  Lista completa de la cola
   6.  Inscripción en cola
   ============================================================ */

'use strict';

/* ============================================================
   1. AUTENTICACIÓN
   ============================================================ */
const session = JSON.parse(localStorage.getItem('chaski_user') || 'null');
if (!session || session.role !== 'driver') {
  window.location.href = '../login.html';
}

const DRIVER_DATA = {
  'eloy.mamani':     { name: 'Eloy Mamani',     vehicle: '001', plate: 'PUN-001', company: 'Virgen de Fátima',     queuePos: 5 },
  'jose.quispe':     { name: 'José Quispe',      vehicle: '002', plate: 'PUN-002', company: 'Surandino',            queuePos: 2 },
  'abraham.morales': { name: 'Abraham Morales',  vehicle: '003', plate: 'PUN-003', company: 'San Francisco de Borja', queuePos: 3 },
  'juan.perez':      { name: 'Juan Pérez',       vehicle: '004', plate: 'PUN-004', company: 'Virgen de Fátima II',  queuePos: 4 },
  'carlos.ticona':   { name: 'Carlos Ticona',    vehicle: '005', plate: 'PUN-005', company: 'San Miguel',           queuePos: 6 },
};

const driver = DRIVER_DATA[session.username] || {
  name: session.name, vehicle: '001', plate: 'PUN-001', company: '—', queuePos: 1,
};

/* Sidebar */
const nameEl    = document.getElementById('sidebarDriverName');
const vehicleEl = document.getElementById('sidebarVehicle');
const companyEl = document.getElementById('sidebarCompany');
if (nameEl)    nameEl.textContent    = driver.name;
if (vehicleEl) vehicleEl.textContent = `Unidad ${driver.vehicle} · ${driver.plate}`;
if (companyEl) companyEl.textContent = driver.company;

function logout() {
  localStorage.removeItem('chaski_user');
  window.location.href = '../login.html';
}
window.logout = logout;


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
   3. DATOS DEMO DE LA COLA
   ============================================================ */
const COMPANIES = ['Virgen de Fátima', 'Surandino', 'San Francisco de Borja', 'Virgen de Fátima II', 'San Miguel'];
const QUEUE_DEMO = [
  { pos: 1, unit: '007', name: 'Roberto Flores', company: COMPANIES[0], status: 'calling',  isYou: false },
  { pos: 2, unit: '002', name: 'José Quispe',     company: COMPANIES[1], status: 'ramp',     isYou: session.username === 'jose.quispe' },
  { pos: 3, unit: '003', name: 'Abraham Morales', company: COMPANIES[2], status: 'ramp',     isYou: session.username === 'abraham.morales' },
  { pos: 4, unit: '004', name: 'Juan Pérez',      company: COMPANIES[3], status: 'outside',  isYou: session.username === 'juan.perez' },
  { pos: 5, unit: '001', name: 'Eloy Mamani',     company: COMPANIES[0], status: 'outside',  isYou: session.username === 'eloy.mamani' },
  { pos: 6, unit: '005', name: 'Carlos Ticona',   company: COMPANIES[4], status: 'waiting',  isYou: session.username === 'carlos.ticona' },
  { pos: 7, unit: '008', name: 'Marcos Huanca',   company: COMPANIES[1], status: 'waiting',  isYou: false },
  { pos: 8, unit: '009', name: 'David Condori',   company: COMPANIES[2], status: 'waiting',  isYou: false },
  { pos: 9, unit: '010', name: 'Felipe Apaza',    company: COMPANIES[3], status: 'waiting',  isYou: false },
  { pos:10, unit: '011', name: 'Héctor Larico',   company: COMPANIES[0], status: 'waiting',  isYou: false },
  { pos:11, unit: '006', name: 'Víctor Limachi',  company: COMPANIES[4], status: 'departed', isYou: false },
  { pos:12, unit: '012', name: 'Arturo Ccama',    company: COMPANIES[1], status: 'departed', isYou: false },
];

const STATUS_LABEL = {
  calling:  'LLAMANDO',
  ramp:     'EN RAMPA',
  outside:  'EXTERIOR',
  waiting:  'EN ESPERA',
  departed: 'SALIÓ',
};

const STATUS_BADGE = {
  calling:  'status-badge active',
  ramp:     'status-badge transit',
  outside:  'status-badge pending',
  waiting:  'status-badge',
  departed: 'status-badge completed',
};


/* ============================================================
   4. TARJETA "MI TURNO" + BARRA EN VIVO
   ============================================================ */
function renderMyTurn() {
  const myEntry = QUEUE_DEMO.find(q => q.isYou);
  const numEl   = document.getElementById('myTurnNum');
  const posEl   = document.getElementById('myTurnPos');
  const waitEl  = document.getElementById('myWaitTime');

  if (myEntry) {
    if (numEl) numEl.textContent = `#${myEntry.pos}`;
    if (posEl) {
      const msgs = {
        calling: '🔴 Estás llamando — ¡prepara tu vehículo ahora!',
        ramp:    '🟡 Estás en la rampa — próxima salida',
        outside: '🔵 Posición exterior — espera tu llamado',
        waiting: '⚪ En zona de espera del terminal',
        departed:'✅ Ya saliste hoy',
      };
      posEl.textContent = msgs[myEntry.status] || STATUS_LABEL[myEntry.status];
    }
    /* Tiempo estimado de espera */
    if (waitEl) {
      const minsPerUnit = 35;
      const ahead       = QUEUE_DEMO.filter(q => q.pos < myEntry.pos && q.status !== 'departed').length;
      if (ahead === 0)  waitEl.textContent = 'Es tu turno';
      else              waitEl.textContent = `~${ahead * minsPerUnit} min`;
    }
  } else {
    if (numEl) numEl.textContent = '—';
    if (posEl) posEl.textContent = 'No estás inscrito en la cola de hoy';
    if (waitEl) waitEl.textContent = '—';
  }

  /* Fecha label */
  const dateLabel = document.getElementById('queueDateLabel');
  if (dateLabel) {
    const now = new Date();
    dateLabel.textContent = now.toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long'});
  }
}
renderMyTurn();

/* Barra en vivo */
function renderLiveBar() {
  const calling = QUEUE_DEMO.find(q => q.status === 'calling');
  const ramp    = QUEUE_DEMO.filter(q => q.status === 'ramp');
  const ready   = QUEUE_DEMO.filter(q => q.status === 'outside');

  const calEl   = document.getElementById('liveCallingUnit');
  const rampEl  = document.getElementById('liveRampUnits');
  const readyEl = document.getElementById('liveReadyUnits');

  if (calEl)   calEl.textContent   = calling ? `Unidad ${calling.unit}` : 'Ninguna';
  if (rampEl)  rampEl.textContent  = `${ramp.length} / 2`;
  if (readyEl) readyEl.textContent = `${ready.length} unidades`;

  /* Total badge */
  const totalBadge = document.getElementById('queueTotalBadge');
  if (totalBadge) totalBadge.textContent = `${QUEUE_DEMO.length} unidades`;
}
renderLiveBar();


/* ============================================================
   5. LISTA COMPLETA
   ============================================================ */
function renderFullQueue() {
  const list = document.getElementById('fullQueueList');
  if (!list) return;

  list.innerHTML = QUEUE_DEMO.map(item => {
    const isActive  = ['calling','ramp','outside'].includes(item.status);
    const waitAhead = QUEUE_DEMO.filter(q => q.pos < item.pos && q.status !== 'departed').length;
    const waitMins  = waitAhead * 35;
    return `
      <div class="dq-list-item ${item.isYou ? 'is-you' : ''} ${item.status === 'departed' ? 'departed' : ''}">
        <span class="dq-list-pos ${isActive ? 'active' : ''}">${item.pos}</span>
        <div class="dq-list-main">
          <div class="dq-list-name">
            ${item.name}
            ${item.isYou ? '<span class="dq-you-tag">TÚ</span>' : ''}
          </div>
          <div class="dq-list-meta">
            <span>Unidad ${item.unit} · ${item.company}</span>
            ${item.status !== 'departed' ? `<span class="dq-list-wait">~${waitMins} min</span>` : ''}
          </div>
        </div>
        <span class="${STATUS_BADGE[item.status]}">${STATUS_LABEL[item.status]}</span>
      </div>`;
  }).join('');
}
renderFullQueue();


/* ============================================================
   6. INSCRIPCIÓN / AUSENCIA
   ============================================================ */
function registerInQueue() {
  const now = new Date();
  const hrs = now.getHours(); const mins = now.getMinutes();
  const canReg = hrs > 18 || (hrs === 18 && mins >= 30);
  if (!canReg) {
    showQueueToast(`⚠️ La inscripción abre a las 6:30 PM. Hora actual: ${now.toLocaleTimeString('es-PE')}`, 'warn');
    return;
  }
  if (confirm('¿Confirmas tu inscripción en la cola de mañana?')) {
    showQueueToast('✅ ¡Inscripto exitosamente para mañana!');
    const btn = document.getElementById('btnRegister');
    if (btn) { btn.innerHTML = '<i class="fas fa-check-circle"></i><span>Inscrito</span><small>para mañana</small>'; btn.disabled = true; }
  }
}
window.registerInQueue = registerInQueue;

function reportAbsence() {
  if (confirm('¿Confirmas que NO saldrás hoy?\n\nEl administrador y el conductor siguiente serán notificados.')) {
    showQueueToast('✅ Ausencia reportada. El administrador fue notificado.');
  }
}
window.reportAbsence = reportAbsence;

function showQueueToast(msg, type='ok') {
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
  t.style.transform = 'translateY(0)'; t.style.opacity = '1';
  setTimeout(() => { t.style.transform = 'translateY(80px)'; t.style.opacity = '0'; }, 3500);
}

/* ============================================================
   SIDEBAR TOGGLE
   ============================================================ */
document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar')?.classList.toggle('open');
});
