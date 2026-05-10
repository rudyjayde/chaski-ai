/* ============================================================
   queue.js — Lógica de la página de Lista Diaria / Cola
   Chaski AI v2.0
   ============================================================
   Contenido:
   1.  Autenticación y sesión
   2.  Datos demo de la cola del día
   3.  KPI de la cola
   4.  Tabla de la cola (con filtros)
   5.  Diagrama de posiciones en terminal
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
   2. DATOS DEMO DE LA COLA
   ============================================================ */
const COMPANIES  = ['Virgen de Fátima', 'Surandino', 'San Francisco de Borja', 'Virgen de Fátima II', 'San Miguel'];
const DRIVERS    = ['Eloy Mamani', 'José Quispe', 'Abraham Morales', 'Juan Pérez', 'Carlos Ticona',
                    'Roberto Flores', 'Marcos Huanca', 'David Condori', 'Felipe Apaza', 'Héctor Larico',
                    'Víctor Limachi', 'Arturo Ccama', 'Miguel Calisaya', 'Raúl Pari', 'Esteban Mamani'];

/**
 * Posiciones posibles:
 *   calling  — unidad llamando (primero en salir)
 *   ramp1    — rampa posición 1
 *   ramp2    — rampa posición 2
 *   outside1 — exterior posición 1
 *   outside2 — exterior posición 2
 *   waiting  — en zona de espera
 *   departed — ya salió
 */
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

const POS_BADGE_CLASS = {
  calling:   'calling',
  ramp1:     'ramp',
  ramp2:     'ramp',
  outside1:  'outside',
  outside2:  'outside',
  waiting:   'waiting',
  departed:  'departed',
  cancelled: 'cancelled',
};

/** Posiciones ordenadas (las primeras 5 son las "en terminal") */
const POSITIONS_ORDER = ['calling', 'ramp1', 'ramp2', 'outside1', 'outside2'];

function generateQueue() {
  const queue = [];
  const now   = new Date();
  const totalUnits = 15; // 15 unidades inscritas

  for (let i = 0; i < totalUnits; i++) {
    const cIdx = i % COMPANIES.length;
    const dIdx = i % DRIVERS.length;
    const unit = String(cIdx * 12 + dIdx + 1).padStart(3, '0');

    /* Asignar posición */
    let position;
    if (i < POSITIONS_ORDER.length) {
      position = POSITIONS_ORDER[i];
    } else if (i < 8) {
      position = 'departed'; // algunos ya salieron
    } else {
      position = 'waiting';
    }

    /* Hora de inscripción (entre 18:30 y 20:30 del día anterior) */
    const inscribed = new Date(now);
    inscribed.setDate(now.getDate() - 1);
    inscribed.setHours(18 + Math.floor(i / 6), 30 + (i * 7) % 30, 0);

    /* Hora de salida (solo si departed) */
    let departure = null;
    if (position === 'departed') {
      departure = new Date(now);
      departure.setHours(6 + i, Math.floor(Math.random() * 60), 0);
    }

    queue.push({
      turn:      i + 1,
      unit,
      plate:     `PUN-${unit}`,
      company:   COMPANIES[cIdx],
      companyIdx: cIdx,
      driver:    DRIVERS[dIdx],
      position,
      inscribed,
      departure,
    });
  }
  return queue;
}

const QUEUE = generateQueue();


/* ============================================================
   3. KPI DE LA COLA
   ============================================================ */
function updateQueueKPIs() {
  const total     = QUEUE.length;
  const departed  = QUEUE.filter(q => q.position === 'departed').length;
  const waiting   = QUEUE.filter(q => q.position === 'waiting').length;
  const inTerminal = QUEUE.filter(q => POSITIONS_ORDER.includes(q.position)).length;
  const companies  = new Set(QUEUE.map(q => q.companyIdx)).size;

  document.getElementById('qTotal').textContent      = total;
  document.getElementById('qDeparted').textContent   = departed;
  document.getElementById('qWaiting').textContent    = waiting;
  document.getElementById('qInTerminal').textContent = inTerminal;
  document.getElementById('qCompanies').textContent  = companies;
}


/* ============================================================
   4. TABLA DE LA COLA
   ============================================================ */
function renderQueueTable() {
  const tbody   = document.getElementById('queueBody');
  const search  = (document.getElementById('qSearch')?.value || '').toLowerCase();
  const company = document.getElementById('qFilterCompany')?.value;

  const filtered = QUEUE.filter(q => {
    if (search) {
      const h = `${q.unit} ${q.plate} ${q.driver}`.toLowerCase();
      if (!h.includes(search)) return false;
    }
    if (company !== '' && company !== undefined && String(q.companyIdx) !== company) return false;
    return true;
  });

  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-muted)">Sin registros</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(q => {
    const inscribedStr = q.inscribed.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    const departedStr  = q.departure
      ? q.departure.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
      : '—';
    const isDone   = q.position === 'departed' || q.position === 'cancelled';
    const rowStyle = isDone ? 'opacity:0.55' : '';
    const sanctionBadge = q.sanctioned
      ? '<span style="display:inline-block;margin-left:5px;font-size:10px;color:var(--gold)"><i class="fas fa-gavel"></i></span>'
      : '';

    const statusCell = q.position === 'departed'
      ? '<span class="status-badge completed"><i class="fas fa-check-circle"></i> Salió</span>'
      : q.position === 'cancelled'
        ? '<span class="status-badge" style="background:rgba(255,68,68,.15);color:var(--danger)"><i class="fas fa-ban"></i> Cancelado</span>'
        : '<span class="status-badge transit"><i class="fas fa-clock"></i> En espera</span>';

    const actionsCell = !isDone ? `
      <div class="q-act-group">
        <button class="q-act-btn q-act-cancel" onclick="cancelTrip(${q.turn})" title="Cancelar viaje">
          <i class="fas fa-ban"></i>
        </button>
        <button class="q-act-btn q-act-last" onclick="sendToLast(${q.turn})" title="Enviar al final de la cola">
          <i class="fas fa-arrow-down"></i>
        </button>
        <button class="q-act-btn q-act-sanction" onclick="openSanctionModal(${q.turn})" title="Aplicar sanción">
          <i class="fas fa-gavel"></i>
        </button>
      </div>` : '<span style="color:var(--text-muted);font-size:12px">—</span>';

    return `
      <tr style="${rowStyle}">
        <td style="font-family:'Rajdhani',sans-serif;font-weight:700;color:var(--primary);font-size:18px">${q.turn}</td>
        <td>
          <span style="font-family:'Rajdhani',sans-serif;font-weight:700;color:var(--primary)">${q.unit}</span>
        </td>
        <td style="color:var(--text-muted)">${q.plate}</td>
        <td style="font-size:12px;color:var(--text-sub)">${q.company}</td>
        <td>${q.driver}${sanctionBadge}</td>
        <td>
          <span class="pos-badge ${POS_BADGE_CLASS[q.position]}">
            ${POS_LABEL[q.position]}
          </span>
        </td>
        <td style="color:var(--text-muted)">${inscribedStr}</td>
        <td>${departedStr}</td>
        <td>${statusCell}</td>
        <td>${actionsCell}</td>
      </tr>
    `;
  }).join('');
}

document.getElementById('qSearch')?.addEventListener('input', renderQueueTable);
document.getElementById('qFilterCompany')?.addEventListener('change', renderQueueTable);


/* ============================================================
   5. DIAGRAMA DE POSICIONES EN TERMINAL
   ============================================================ */
function renderTerminalDiagram() {
  /* Mapear posiciones a slots del HTML */
  const slotMap = {
    calling:  document.getElementById('slotCalling'),
    ramp1:    document.getElementById('slotRamp1'),
    ramp2:    document.getElementById('slotRamp2'),
    outside1: document.getElementById('slotOut1'),
    outside2: document.getElementById('slotOut2'),
  };

  /* Limpiar todos los slots */
  Object.values(slotMap).forEach(el => {
    if (el) {
      el.innerHTML = '—';
      el.classList.add('empty');
    }
  });

  /* Llenar slots con el vehículo asignado */
  QUEUE.forEach(q => {
    const slot = slotMap[q.position];
    if (!slot) return;
    slot.classList.remove('empty');
    slot.innerHTML = `
      ${q.unit}
      <small>${q.driver.split(' ')[0]}</small>
    `;
  });

  /* Lista de espera */
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
    </div>
  `).join('');
}


/* ============================================================
   6. ACCIONES DE COLA
   ============================================================ */

function cancelTrip(turn) {
  const entry = QUEUE.find(q => q.turn === turn);
  if (!entry) return;
  if (!confirm(`¿Cancelar el viaje de ${entry.driver} (Unidad ${entry.unit})?\n\nEsta acción no se puede deshacer.`)) return;
  entry.position = 'cancelled';
  entry.departure = new Date();
  renderQueueTable();
  renderTerminalDiagram();
  updateQueueKPIs();
  showQueueToast(`Viaje de ${entry.driver} cancelado`);
}
window.cancelTrip = cancelTrip;

function sendToLast(turn) {
  const entry = QUEUE.find(q => q.turn === turn);
  if (!entry) return;
  if (!confirm(`¿Enviar a ${entry.driver} (Unidad ${entry.unit}) al final de la cola?`)) return;

  const active = QUEUE.filter(q => q.position !== 'departed' && q.position !== 'cancelled' && q.turn !== turn);
  const maxTurn = active.length > 0 ? Math.max(...active.map(q => q.turn)) : turn;
  entry.position = 'waiting';
  entry.turn = maxTurn + 1;

  /* Renumerar turnos para que sean consecutivos */
  QUEUE.sort((a, b) => a.turn - b.turn).forEach((q, i) => { q.turn = i + 1; });

  renderQueueTable();
  renderTerminalDiagram();
  updateQueueKPIs();
  showQueueToast(`${entry.driver} enviado al final de la cola`);
}
window.sendToLast = sendToLast;

/* --- Modal de sanción --- */
let sanctionTurn = null;

function openSanctionModal(turn) {
  const entry = QUEUE.find(q => q.turn === turn);
  if (!entry) return;
  sanctionTurn = turn;
  document.getElementById('sanctionDriverName').textContent = `${entry.driver} — Unidad ${entry.unit}`;
  document.getElementById('sanctionDesc').value = '';
  document.getElementById('sanctionModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
window.openSanctionModal = openSanctionModal;

function closeSanctionModal() {
  document.getElementById('sanctionModal').classList.remove('open');
  document.body.style.overflow = '';
  sanctionTurn = null;
}
window.closeSanctionModal = closeSanctionModal;

document.getElementById('sanctionModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeSanctionModal();
});

function applySanction() {
  const entry = QUEUE.find(q => q.turn === sanctionTurn);
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

  /* Guardar notificación en el panel del conductor */
  const username = entry.driver.toLowerCase().replace(/\s+/g, '.').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const key = 'chaski_driver_notifs_' + username;
  const notifs = JSON.parse(localStorage.getItem(key) || '[]');
  notifs.unshift({
    id:   Date.now(),
    type: 'alert',
    read: false,
    msg:  `⚠️ Sanción: ${reasonLabels[reason]}`,
    sub:  desc || 'Administración ATIPCAR',
    at:   new Date().toISOString(),
  });
  localStorage.setItem(key, JSON.stringify(notifs));

  entry.sanctioned = true;
  closeSanctionModal();
  renderQueueTable();
  showQueueToast(`Sanción aplicada a ${entry.driver}`);
}
window.applySanction = applySanction;

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
  updateQueueKPIs();
  renderQueueTable();
  renderTerminalDiagram();
})();
