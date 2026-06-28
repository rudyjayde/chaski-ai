'use strict';

const COMM_API = '/api/communications';

// ── Carga y renderiza el panel de comunicados ─────────────────
async function loadCommunications() {
  const container = document.getElementById('commsList');
  if (!container) return;

  try {
    const res  = await fetch(COMM_API);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    if (!data.communications.length) {
      container.innerHTML = `<div class="comms-empty"><i class="fas fa-bullhorn"></i><p>Sin comunicados aún</p></div>`;
      return;
    }

    const TYPE_ICON  = { info: 'fa-info-circle', alert: 'fa-exclamation-triangle', urgent: 'fa-bell' };
    const TYPE_COLOR = { info: '#00C8FF', alert: '#FFB800', urgent: '#FF6B6B' };
    const TYPE_LABEL = { info: 'Info', alert: 'Alerta', urgent: 'Urgente' };

    container.innerHTML = data.communications.map(c => `
      <div class="comm-item" data-id="${c.id}">
        <div class="comm-icon" style="color:${TYPE_COLOR[c.type] || '#00C8FF'}">
          <i class="fas ${TYPE_ICON[c.type] || 'fa-bell'}"></i>
        </div>
        <div class="comm-body">
          <div class="comm-title">${escapeHtml(c.title)}</div>
          <div class="comm-meta">
            <span class="comm-badge" style="background:${TYPE_COLOR[c.type]}22;color:${TYPE_COLOR[c.type]}">${TYPE_LABEL[c.type] || c.type}</span>
            <span>${formatCommDate(c.created_at)}</span>
            <span><i class="fas fa-users"></i> ${c.total_sent} enviado${c.total_sent != 1 ? 's' : ''} · ${c.total_read} leído${c.total_read != 1 ? 's' : ''}</span>
          </div>
        </div>
        <button class="comm-del-btn" onclick="deleteCommunication('${c.id}')" title="Eliminar">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `).join('');
  } catch (err) {
    if (container) container.innerHTML = `<div class="comms-empty"><i class="fas fa-exclamation-triangle"></i><p>Error al cargar: ${err.message}</p></div>`;
  }
}

// ── Modal Nuevo Comunicado ────────────────────────────────────
window.openCommsModal = function () {
  document.getElementById('commTitle').value = '';
  document.getElementById('commType').value  = 'info';
  document.getElementById('commBody').value  = '';
  document.getElementById('commFormError').style.display = 'none';
  document.getElementById('commsModal').classList.add('open');
};

window.closeCommsModal = function () {
  document.getElementById('commsModal').classList.remove('open');
};

window.submitCommunication = async function (e) {
  e.preventDefault();
  const title   = document.getElementById('commTitle').value.trim();
  const type    = document.getElementById('commType').value;
  const body    = document.getElementById('commBody').value.trim();
  const errBox  = document.getElementById('commFormError');
  errBox.style.display = 'none';

  if (!title || !body) {
    errBox.textContent   = 'Título y contenido son requeridos.';
    errBox.style.display = 'block';
    return;
  }

  const session = JSON.parse(localStorage.getItem('chaski_user') || 'null');
  const btn = document.getElementById('commSubmitBtn');
  btn.disabled  = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando…';

  try {
    const res  = await fetch(COMM_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, type, created_by: session?.id || null }),
    });
    const data = await res.json();

    if (!res.ok) {
      errBox.textContent   = data.error || 'Error al enviar';
      errBox.style.display = 'block';
      return;
    }

    window.closeCommsModal();
    await loadCommunications();
    showCommToast(`Comunicado enviado a ${data.sent_to} conductor${data.sent_to !== 1 ? 'es' : ''}.`);
  } catch (err) {
    errBox.textContent   = 'Error de conexión con el servidor';
    errBox.style.display = 'block';
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar a todos';
  }
};

// ── Eliminar comunicado ───────────────────────────────────────
window.deleteCommunication = async function (id) {
  if (!confirm('¿Eliminar este comunicado? Se quitará del buzón de todos los conductores.')) return;
  try {
    await fetch(`${COMM_API}/${id}`, { method: 'DELETE' });
    await loadCommunications();
  } catch {
    alert('Error al eliminar');
  }
};

// ── Helpers ───────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatCommDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function showCommToast(msg) {
  let toast = document.getElementById('commToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'commToast';
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#00C8FF;color:#000;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(0,200,255,.3)';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

// ── Init ─────────────────────────────────────────────────────
loadCommunications();
