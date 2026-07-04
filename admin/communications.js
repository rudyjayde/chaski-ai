'use strict';

const COMM_API = '/api/communications';

const TYPE_ICON  = {
  info:       'info',
  alert:      'triangle-alert',
  urgent:     'bell',
  reglamento: 'book-open',
};
const TYPE_COLOR = {
  info:       '#00C8FF',
  alert:      '#FFB800',
  urgent:     '#FF6B6B',
  reglamento: '#AA88FF',
};
const TYPE_LABEL = {
  info:       'Comunicado',
  alert:      'Alerta',
  urgent:     'Urgente',
  reglamento: 'Reglamento',
};

// ── Carga y renderiza la lista ────────────────────────────────
async function loadCommunications() {
  const container = document.getElementById('commsList');
  if (!container) return;

  try {
    const res  = await authFetch(COMM_API);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    if (!data.communications.length) {
      container.innerHTML = `<div class="comms-empty">
        <i data-lucide="megaphone"></i>
        <p>Sin comunicados aún. Usa el botón para crear el primero.</p>
      </div>`;
      return;
    }

    container.innerHTML = data.communications.map(c => {
      const color = TYPE_COLOR[c.type] || '#00C8FF';
      const label = TYPE_LABEL[c.type] || c.type;
      const icon  = TYPE_ICON[c.type]  || 'bell';
      const isReg = c.type === 'reglamento';

      return `
        <div class="comm-item ${isReg ? 'comm-item--reglamento' : ''}" data-id="${c.id}">
          <div class="comm-icon" style="color:${color}">
            <i data-lucide="${icon}"></i>
          </div>
          <div class="comm-body">
            <div class="comm-title">${escapeHtml(c.title)}</div>
            <div class="comm-meta">
              <span class="comm-badge" style="background:${color}22;color:${color}">${label}</span>
              <span>${formatCommDate(c.created_at)}</span>
              <span><i data-lucide="users" style="width:12px;height:12px;vertical-align:middle"></i>
                ${c.total_sent} enviado${c.total_sent != 1 ? 's' : ''} ·
                ${c.total_read} leído${c.total_read != 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            ${isReg ? `
              <button class="comm-edit-btn" onclick="openEditComm('${c.id}','${escapeHtml(c.title).replace(/'/g,"\\'")}','${c.type}','${escapeHtml(c.body).replace(/\n/g,'\\n').replace(/'/g,"\\'")}')">
                <i data-lucide="pen"></i> Editar
              </button>` : ''}
            <button class="comm-del-btn" onclick="deleteCommunication('${c.id}')" title="Eliminar">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    if (container) container.innerHTML = `<div class="comms-empty">
      <i data-lucide="alert-triangle"></i>
      <p>Error al cargar: ${err.message}</p>
    </div>`;
  }
}

// ── Modal: abrir para NUEVO comunicado ───────────────────────
window.openCommsModal = function () {
  document.getElementById('commEditId').value = '';
  document.getElementById('commTitle').value  = '';
  document.getElementById('commType').value   = 'info';
  document.getElementById('commBody').value   = '';
  document.getElementById('commFormError').style.display = 'none';
  document.getElementById('commsModalTitle').innerHTML = '<i data-lucide="megaphone"></i> Nuevo Comunicado';
  document.getElementById('commSubmitLabel').textContent = 'Enviar a todos';
  document.getElementById('commModalInfo').style.display = '';
  document.getElementById('commReglamentoHint').style.display = 'none';
  document.getElementById('commsModal').classList.add('open');
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

// ── Modal: abrir para EDITAR reglamento ──────────────────────
window.openEditComm = function (id, title, type, body) {
  document.getElementById('commEditId').value = id;
  document.getElementById('commTitle').value  = title;
  document.getElementById('commType').value   = type;
  document.getElementById('commBody').value   = body.replace(/\\n/g, '\n');
  document.getElementById('commFormError').style.display = 'none';
  document.getElementById('commsModalTitle').innerHTML = '<i data-lucide="pen"></i> Editar Reglamento';
  document.getElementById('commSubmitLabel').textContent = 'Guardar cambios';
  document.getElementById('commModalInfo').style.display = 'none';
  document.getElementById('commReglamentoHint').style.display = '';
  document.getElementById('commsModal').classList.add('open');
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

// ── Cambio de tipo: mostrar/ocultar hint de reglamento ───────
window.onCommTypeChange = function () {
  const isReg = document.getElementById('commType').value === 'reglamento';
  document.getElementById('commReglamentoHint').style.display = isReg ? '' : 'none';
  document.getElementById('commModalInfo').style.display      = isReg ? 'none' : '';
};

window.closeCommsModal = function () {
  document.getElementById('commsModal').classList.remove('open');
};

// ── Enviar / Actualizar ───────────────────────────────────────
window.submitCommunication = async function (e) {
  e.preventDefault();
  const editId  = document.getElementById('commEditId').value;
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
  const btn     = document.getElementById('commSubmitBtn');
  btn.disabled  = true;
  btn.innerHTML = '<i data-lucide="loader-2"></i> Guardando…';

  try {
    let res, data;

    if (editId) {
      // Actualizar reglamento existente
      res  = await authFetch(`${COMM_API}/${editId}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title, body, type }),
      });
      data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar');
      window.closeCommsModal();
      await loadCommunications();
      if (window.toast) window.toast.success('Reglamento actualizado correctamente.');
      else showCommToast('Reglamento actualizado.');
    } else {
      // Nuevo comunicado
      res  = await authFetch(COMM_API, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title, body, type, created_by: session?.id || null }),
      });
      data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar');
      window.closeCommsModal();
      await loadCommunications();
      const sent = data.sent_to ?? 0;
      if (window.toast) window.toast.success(`${TYPE_LABEL[type] || 'Comunicado'} enviado a ${sent} conductor${sent !== 1 ? 'es' : ''}.`);
      else showCommToast(`Enviado a ${sent} conductores.`);
    }
  } catch (err) {
    errBox.textContent   = err.message || 'Error de conexión';
    errBox.style.display = 'block';
  } finally {
    btn.disabled  = false;
    btn.innerHTML = `<i data-lucide="send"></i> <span id="commSubmitLabel">${editId ? 'Guardar cambios' : 'Enviar a todos'}</span>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
};

// ── Eliminar ──────────────────────────────────────────────────
window.deleteCommunication = async function (id) {
  if (!confirm('¿Eliminar este comunicado? Se quitará del buzón de todos los conductores.')) return;
  try {
    await authFetch(`${COMM_API}/${id}`, { method: 'DELETE' });
    await loadCommunications();
  } catch {
    alert('Error al eliminar');
  }
};

// ── Helpers ───────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCommDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function showCommToast(msg) {
  if (window.toast) { window.toast.success(msg); return; }
  let t = document.getElementById('commToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'commToast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#00C8FF;color:#000;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(0,200,255,.3);transition:opacity .3s';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.style.opacity = '0'; }, 3000);
}

// ── CSS de estilos para reglamento (inyectar una vez) ─────────
(function injectCommStyles() {
  if (document.getElementById('comm-extra-styles')) return;
  const s = document.createElement('style');
  s.id = 'comm-extra-styles';
  s.textContent = `
    .comm-item { display:flex;align-items:center;gap:14px;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.05); }
    .comm-item:last-child { border-bottom:none; }
    .comm-item--reglamento { background:rgba(170,136,255,.04);border-left:3px solid #AA88FF; }
    .comm-icon { width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.05);display:flex;align-items:center;justify-content:center;flex-shrink:0; }
    .comm-body { flex:1;min-width:0; }
    .comm-title { font-size:0.9rem;font-weight:600;color:var(--text-main,#E8F0FE);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
    .comm-meta { display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--text-muted,#7A9BC4); }
    .comm-badge { padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase; }
    .comm-del-btn { background:rgba(255,107,107,.1);border:1px solid rgba(255,107,107,.2);color:#FF6B6B;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:12px;display:flex;align-items:center;gap:4px; }
    .comm-del-btn:hover { background:rgba(255,107,107,.2); }
    .comm-edit-btn { background:rgba(170,136,255,.1);border:1px solid rgba(170,136,255,.25);color:#AA88FF;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:12px;display:flex;align-items:center;gap:4px; }
    .comm-edit-btn:hover { background:rgba(170,136,255,.2); }
    .comms-empty { display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;gap:12px;color:var(--text-muted,#7A9BC4);font-size:13px; }
    .comms-empty i { opacity:.3; }
  `;
  document.head.appendChild(s);
})();

// ── Init ──────────────────────────────────────────────────────
loadCommunications();
