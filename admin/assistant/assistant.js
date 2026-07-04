// ============================================================
// CHASKI AI 2.0 — Asistente IA Frontend
// admin/assistant.js
// ============================================================

const BACKEND_URL = '';

// ── Estado ──────────────────────────────────────────────────
let history    = [];   // { role: 'user'|'assistant', content: string }
let isLoading  = false;

// ── Auto-resize del textarea ─────────────────────────────────
const chatInput = document.getElementById('chatInput');
chatInput.addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// Enviar con Enter (Shift+Enter = nueva línea)
chatInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// ── Hora formateada ──────────────────────────────────────────
function nowTime() {
  return new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

// ── Scroll al último mensaje ─────────────────────────────────
function scrollToBottom() {
  const area = document.getElementById('messagesArea');
  area.scrollTop = area.scrollHeight;
}

// ── Ocultar bienvenida al primer mensaje ─────────────────────
function hideWelcome() {
  const w = document.getElementById('welcomeMsg');
  if (w) w.remove();
}

// ── Agregar fila de mensaje al DOM ───────────────────────────
function appendMessageRow(role, bubbleHTML, extraHTML = '') {
  hideWelcome();

  const area = document.getElementById('messagesArea');
  const row  = document.createElement('div');
  row.className = `msg-row ${role}`;

  const avatarIcon = role === 'ai' ? 'fa-robot' : 'fa-user';

  row.innerHTML = `
    <div class="msg-avatar"><i class="fas ${avatarIcon}"></i></div>
    <div class="msg-content">
      <div class="bubble">${bubbleHTML}</div>
      ${extraHTML}
      <div class="msg-time">${nowTime()}</div>
    </div>
  `;

  area.appendChild(row);
  scrollToBottom();
  return row;
}

// ── Indicador de typing ──────────────────────────────────────
function showTyping() {
  hideWelcome();
  const area = document.getElementById('messagesArea');
  const row  = document.createElement('div');
  row.className = 'msg-row ai';
  row.id = 'typingRow';
  row.innerHTML = `
    <div class="msg-avatar"><i class="fas fa-robot"></i></div>
    <div class="msg-content">
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  area.appendChild(row);
  scrollToBottom();
}

function hideTyping() {
  const t = document.getElementById('typingRow');
  if (t) t.remove();
}

// ── Renderizar datos adicionales según la intención ──────────
function renderData(intent, data) {
  if (!data) return '';

  // Vehículo específico
  if (intent === 'vehicle' && data.vehicle) {
    const v = data.vehicle;
    const kpis = `
      <div class="data-cards">
        <div class="data-kpi">
          <span class="data-kpi-label">Viajes (${data.periodo})</span>
          <span class="data-kpi-value">${v.trips_today}</span>
        </div>
        <div class="data-kpi">
          <span class="data-kpi-label">Pasajeros</span>
          <span class="data-kpi-value green">${v.passengers_today}</span>
        </div>
        <div class="data-kpi">
          <span class="data-kpi-label">Recaudación</span>
          <span class="data-kpi-value gold">S/. ${parseFloat(v.revenue_today).toFixed(2)}</span>
        </div>
        <div class="data-kpi">
          <span class="data-kpi-label">Estado</span>
          <span class="data-kpi-value" style="font-size:0.85rem;text-transform:capitalize">${v.status}</span>
        </div>
      </div>`;

    let manifestTable = '';
    if (data.manifests && data.manifests.length > 0) {
      const rows = data.manifests.map(m => `
        <tr>
          <td>${m.manifest_number}</td>
          <td>${m.departure_time ? new Date(m.departure_time).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}) : '—'}</td>
          <td>${m.total_passengers}</td>
          <td>S/. ${parseFloat(m.total_revenue).toFixed(2)}</td>
          <td>${m.status}</td>
        </tr>`).join('');
      manifestTable = `
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>Manifiesto</th><th>Salida</th><th>Pasajeros</th><th>Recaudación</th><th>Estado</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    return kpis + manifestTable;
  }

  // Top conductores / recaudación
  if (intent === 'revenue' && data.top_drivers && data.top_drivers.length > 0) {
    const rows = data.top_drivers.map((d, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${d.driver_name}</td>
        <td>${d.company}</td>
        <td>${d.total_viajes}</td>
        <td>${d.total_pasajeros}</td>
        <td>S/. ${parseFloat(d.total_revenue).toFixed(2)}</td>
      </tr>`).join('');

    return `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>#</th><th>Conductor</th><th>Empresa</th><th>Viajes</th><th>Pasajeros</th><th>Recaudación</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // Estado de flota
  if (intent === 'fleet' && data.por_estado) {
    const kpis = data.por_estado.map(s => `
      <div class="data-kpi">
        <span class="data-kpi-label">${s.status}</span>
        <span class="data-kpi-value">${s.total}</span>
      </div>`).join('');

    const gpsKpis = data.gps ? `
      <div class="data-kpi">
        <span class="data-kpi-label">Con GPS</span>
        <span class="data-kpi-value green">${data.gps.con_gps}</span>
      </div>
      <div class="data-kpi">
        <span class="data-kpi-label">Sin GPS</span>
        <span class="data-kpi-value">${data.gps.sin_gps}</span>
      </div>` : '';

    return `<div class="data-cards">${kpis}${gpsKpis}</div>`;
  }

  // Cola de salida
  if (intent === 'queue' && data.queue && data.queue.length > 0) {
    const rows = data.queue.map(q => `
      <tr>
        <td>${q.posicion}</td>
        <td>${q.association_code || '—'}</td>
        <td>${q.plate || '—'}</td>
        <td>${q.driver_name}</td>
        <td>${q.company}</td>
        <td>${q.estado}</td>
      </tr>`).join('');

    return `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>#</th><th>Unidad</th><th>Placa</th><th>Conductor</th><th>Empresa</th><th>Estado</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // Alertas
  if (intent === 'alerts') {
    let html = '';
    if (data.speed_alerts && data.speed_alerts.length > 0) {
      const rows = data.speed_alerts.map(a => `
        <tr>
          <td>${a.association_code} / ${a.plate}</td>
          <td>${a.driver_name}</td>
          <td>${a.max_speed} km/h</td>
          <td>${a.severity}</td>
          <td>${new Date(a.occurred_at).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}</td>
        </tr>`).join('');
      html += `
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr><th>Unidad</th><th>Conductor</th><th>Vel. máx.</th><th>Severidad</th><th>Hora</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }
    return html;
  }

  // Conductor
  if (intent === 'driver' && data.drivers && data.drivers.length > 0) {
    const d    = data.drivers[0];
    const kpis = `
      <div class="data-cards">
        <div class="data-kpi">
          <span class="data-kpi-label">Viajes (${data.periodo})</span>
          <span class="data-kpi-value">${d.trips_period}</span>
        </div>
        <div class="data-kpi">
          <span class="data-kpi-label">Pasajeros</span>
          <span class="data-kpi-value green">${d.passengers_period}</span>
        </div>
        <div class="data-kpi">
          <span class="data-kpi-label">Recaudación</span>
          <span class="data-kpi-value gold">S/. ${parseFloat(d.revenue_period).toFixed(2)}</span>
        </div>
      </div>`;
    return kpis;
  }

  // Resumen del día
  if (intent === 'summary' && data) {
    const v = data.viajes  || {};
    const c = data.cola    || {};
    const kpis = `
      <div class="data-cards">
        <div class="data-kpi">
          <span class="data-kpi-label">Viajes hoy</span>
          <span class="data-kpi-value">${parseInt(v.total_viajes) || 0}</span>
        </div>
        <div class="data-kpi">
          <span class="data-kpi-label">Pasajeros</span>
          <span class="data-kpi-value green">${parseInt(v.total_pasajeros) || 0}</span>
        </div>
        <div class="data-kpi">
          <span class="data-kpi-label">Recaudación</span>
          <span class="data-kpi-value gold">S/. ${parseFloat(v.total_revenue || 0).toFixed(2)}</span>
        </div>
        <div class="data-kpi">
          <span class="data-kpi-label">En cola</span>
          <span class="data-kpi-value">${parseInt(c.en_cola) || 0}</span>
        </div>
        <div class="data-kpi">
          <span class="data-kpi-label">Salidos</span>
          <span class="data-kpi-value green">${parseInt(c.salidos) || 0}</span>
        </div>
        <div class="data-kpi">
          <span class="data-kpi-label">Manif. abiertos</span>
          <span class="data-kpi-value" ${parseInt(data.manifAbiertos) > 0 ? 'style="color:#F59E0B"' : ''}>${parseInt(data.manifAbiertos) || 0}</span>
        </div>
      </div>`;
    return kpis;
  }

  // Ingresos por empresa
  if (intent === 'companies' && data.empresas && data.empresas.length > 0) {
    const rows = data.empresas.map((e, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${e.company}</strong></td>
        <td>${e.total_drivers}</td>
        <td>${e.total_viajes}</td>
        <td>${e.total_pasajeros}</td>
        <td><strong>S/. ${parseFloat(e.total_revenue).toFixed(2)}</strong></td>
      </tr>`).join('');

    return `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>#</th><th>Empresa</th><th>Conductores</th><th>Viajes</th><th>Pasajeros</th><th>Recaudación</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // Manifiestos sin cerrar
  if (intent === 'open_manifests') {
    if (!data.manifiestos || data.manifiestos.length === 0) {
      return `<div class="data-cards"><div class="data-kpi"><span class="data-kpi-label">Manifiestos abiertos</span><span class="data-kpi-value green">0</span></div></div>`;
    }
    const rows = data.manifiestos.map(m => `
      <tr>
        <td>${m.manifest_number || '—'}</td>
        <td>${m.driver_name}</td>
        <td>${m.association_code || '—'} / ${m.plate || '—'}</td>
        <td>${m.departure_time ? new Date(m.departure_time).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}) : '—'}</td>
        <td>${m.total_passengers || 0}</td>
        <td>S/. ${parseFloat(m.total_revenue || 0).toFixed(2)}</td>
      </tr>`).join('');

    return `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Manifiesto</th><th>Conductor</th><th>Unidad</th><th>Salida</th><th>Pasajeros</th><th>Recaudación</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // Conductores con retrasos
  if (intent === 'delays' && data.conductores && data.conductores.length > 0) {
    const rows = data.conductores.map((c, i) => {
      const mins = parseInt(c.minutos_espera) || 0;
      const alerta = mins > 60 ? 'style="color:#EF4444"' : mins > 30 ? 'style="color:#F59E0B"' : '';
      return `
        <tr>
          <td>${i + 1}</td>
          <td>${c.driver_name}</td>
          <td>${c.association_code || '—'} / ${c.plate || '—'}</td>
          <td>${c.registered_at ? new Date(c.registered_at).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}) : '—'}</td>
          <td>${c.departure_at ? new Date(c.departure_at).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}) : '—'}</td>
          <td><span ${alerta}>${mins} min</span></td>
        </tr>`;
    }).join('');

    return `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>#</th><th>Conductor</th><th>Unidad</th><th>Inscripción</th><th>Salida</th><th>Tiempo espera</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  return '';
}

// ── Generar PDF con window.print() ──────────────────────────
function generatePDF(intent, data) {
  const now   = new Date().toLocaleString('es-PE');
  let content = '';

  if (intent === 'vehicle' && data && data.vehicle) {
    const v = data.vehicle;
    let manifestRows = '';
    if (data.manifests && data.manifests.length > 0) {
      manifestRows = data.manifests.map((m, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${m.manifest_number}</td>
          <td>${m.departure_time ? new Date(m.departure_time).toLocaleString('es-PE') : '—'}</td>
          <td>${m.total_passengers}</td>
          <td>S/. ${parseFloat(m.total_revenue).toFixed(2)}</td>
          <td>${m.status}</td>
        </tr>`).join('');
    }

    content = `
      <h2>Reporte de Vehículo ${v.association_code}</h2>
      <table class="info-table">
        <tr><td><strong>Unidad:</strong></td><td>${v.association_code}</td><td><strong>Placa:</strong></td><td>${v.plate}</td></tr>
        <tr><td><strong>Conductor:</strong></td><td>${v.driver_name}</td><td><strong>Empresa:</strong></td><td>${v.company}</td></tr>
        <tr><td><strong>Estado:</strong></td><td>${v.status}</td><td><strong>Período:</strong></td><td>${data.periodo}</td></tr>
      </table>
      <h3>Resumen del Período</h3>
      <table class="info-table">
        <tr>
          <td><strong>Viajes:</strong> ${v.trips_today}</td>
          <td><strong>Pasajeros:</strong> ${v.passengers_today}</td>
          <td><strong>Recaudación:</strong> S/. ${parseFloat(v.revenue_today).toFixed(2)}</td>
        </tr>
      </table>
      ${manifestRows ? `
        <h3>Manifiestos del Período</h3>
        <table>
          <thead><tr><th>#</th><th>N° Manifiesto</th><th>Salida</th><th>Pasajeros</th><th>Recaudación</th><th>Estado</th></tr></thead>
          <tbody>${manifestRows}</tbody>
        </table>` : ''}`;
  } else if (intent === 'revenue' && data && data.top_drivers) {
    const rows = data.top_drivers.map((d, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${d.driver_name}</td>
        <td>${d.company}</td>
        <td>${d.total_viajes}</td>
        <td>${d.total_pasajeros}</td>
        <td>S/. ${parseFloat(d.total_revenue).toFixed(2)}</td>
      </tr>`).join('');

    content = `
      <h2>Top Conductores — ${data.periodo || 'Período actual'}</h2>
      <table>
        <thead><tr><th>#</th><th>Conductor</th><th>Empresa</th><th>Viajes</th><th>Pasajeros</th><th>Recaudación</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  } else {
    content = '<p>No hay datos disponibles para exportar.</p>';
  }

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte CHASKI AI</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 30px; }
    .pdf-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1D9BD1; padding-bottom: 14px; margin-bottom: 20px; }
    .pdf-header h1 { font-size: 20px; color: #1D9BD1; letter-spacing: 0.1em; }
    .pdf-header span { font-size: 11px; color: #555; }
    h2 { font-size: 14px; margin-bottom: 12px; color: #1D9BD1; }
    h3 { font-size: 12px; margin: 14px 0 8px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #f0f7fb; padding: 7px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #555; border-bottom: 1px solid #ccc; }
    td { padding: 7px 10px; border-bottom: 1px solid #eee; }
    .info-table td { border: none; padding: 4px 10px; }
    .pdf-footer { margin-top: 30px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 10px; color: #888; text-align: center; }
  </style>
</head>
<body>
  <div class="pdf-header">
    <h1>CHASKI AI — Reporte Operativo</h1>
    <span>Generado: ${now}<br>ATIPCAR · Juli–Puno, Puno</span>
  </div>
  ${content}
  <div class="pdf-footer">Generado por Asistente CHASKI AI · Sistema de Gestión de Transportistas · ATIPCAR</div>
</body>
</html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

// ── Tarjeta de descarga PDF ──────────────────────────────────
function renderExportCard(intent, data) {
  const card = document.createElement('div');
  card.className = 'export-card';
  card.innerHTML = `
    <div class="export-card-icon"><i data-lucide="file-text"></i></div>
    <div class="export-card-info">
      <strong>Reporte listo para descargar</strong>
      <span>PDF con los datos consultados · Optimizado para impresión</span>
    </div>
    <button class="export-btn" onclick="generatePDF('${intent}', ${JSON.stringify(data || null).replace(/'/g, "\\'")})">
      <i data-lucide="download"></i> Descargar PDF
    </button>`;
  return card;
}

// ── Función principal: enviar mensaje ────────────────────────
async function sendMessage(overrideText) {
  const text = (overrideText || chatInput.value).trim();
  if (!text || isLoading) return;

  // Limpiar input
  chatInput.value = '';
  chatInput.style.height = 'auto';

  // Mostrar mensaje del usuario
  appendMessageRow('user', escapeHtml(text));

  // Agregar al historial
  history.push({ role: 'user', content: text });

  // Estado de carga
  isLoading = true;
  document.getElementById('sendBtn').disabled = true;
  showTyping();

  try {
    const res = await authFetch(`${BACKEND_URL}/api/assistant/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: text, history: history.slice(0, -1) }),
    });

    hideTyping();

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      appendMessageRow('ai', `<span style="color:#EF4444"><i data-lucide="alert-triangle"></i> ${errData.error || 'Error al conectar con el servidor.'}</span>`);
      return;
    }

    const { response, data, action, intent } = await res.json();

    // Renderizar datos adicionales (tabla, KPIs)
    const extraHTML = renderData(intent, data);

    // Insertar la respuesta
    const msgRow = appendMessageRow('ai', marked(response), extraHTML);

    // Si pide exportar PDF, agregar tarjeta de descarga
    if (action === 'export_pdf') {
      const exportCard = renderExportCard(intent, data);
      msgRow.querySelector('.msg-content').appendChild(exportCard);
      scrollToBottom();
    }

    // Agregar respuesta al historial (sin los datos crudos de BD)
    history.push({ role: 'assistant', content: response });

  } catch (err) {
    hideTyping();
    appendMessageRow('ai', `
      <span style="color:#EF4444">
        <i data-lucide="wifi"></i>
        No se pudo conectar al backend. Verifica que el servidor esté corriendo en <strong>chaski-ai.onrender.com</strong>.
      </span>
      <br><small style="color:#6A8DB0;font-size:0.75rem;margin-top:6px;display:block">
        Inicia el servidor con: <code style="background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px">node backend/server.js</code>
      </small>`);
  } finally {
    isLoading = false;
    document.getElementById('sendBtn').disabled = false;
    chatInput.focus();
  }
}

// ── Botones de sugerencia ────────────────────────────────────
function sendSuggestion(btn) {
  sendMessage(btn.textContent.trim());
}

// ── Escape HTML para mensajes de usuario ─────────────────────
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

// ── Markdown mínimo para respuestas de la IA ─────────────────
function marked(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(255,255,255,0.06);padding:1px 5px;border-radius:4px;font-size:0.85em">$1</code>')
    .replace(/^### (.+)$/gm, '<strong style="display:block;margin:8px 0 4px;color:#DDE8F8">$1</strong>')
    .replace(/^## (.+)$/gm, '<strong style="display:block;margin:10px 0 5px;font-size:1.05em;color:#DDE8F8">$1</strong>')
    .replace(/^- (.+)$/gm, '&nbsp;&nbsp;• $1')
    .replace(/\n/g, '<br>');
}
