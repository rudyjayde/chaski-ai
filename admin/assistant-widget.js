// ============================================================
// CHASKI AI 2.0 — Widget Flotante del Asistente IA
// admin/assistant-widget.js
// Se inyecta automáticamente en todas las páginas admin
// ============================================================

(function () {
  'use strict';

  const BACKEND_URL = '';

  // ── Estado del widget ──────────────────────────────────────
  let isOpen     = false;
  let isLoading  = false;
  let history    = [];
  let unreadCount = 0;

  // ── Construir el HTML del widget ───────────────────────────
  function buildWidget() {
    const wrapper = document.createElement('div');
    wrapper.id = 'aiWidgetRoot';
    wrapper.innerHTML = `
      <!-- Botón flotante -->
      <button id="aiFloatBtn" aria-label="Abrir asistente IA">
        <i class="fas fa-robot ai-icon-robot"></i>
        <i class="fas fa-times ai-icon-close"></i>
        <span id="aiFloatBadge"></span>
      </button>

      <!-- Panel flotante -->
      <div id="aiWidgetPanel" role="dialog" aria-label="Asistente CHASKI AI">

        <!-- Header -->
        <div class="aw-header">
          <div class="aw-avatar">
            <i class="fas fa-robot"></i>
            <span class="aw-status-dot"></span>
          </div>
          <div class="aw-header-info">
            <h3>Asistente CHASKI AI</h3>
            <span>En línea</span>
          </div>
          <button class="aw-close-btn" id="awCloseBtn" aria-label="Cerrar">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- Mensajes -->
        <div class="aw-messages" id="awMessages">
          <div class="aw-welcome" id="awWelcome">
            <div class="aw-welcome-icon"><i class="fas fa-robot"></i></div>
            <h4>¡Hola! Soy el Asistente CHASKI</h4>
            <p>Consulta vehículos, conductores, alertas y más en lenguaje natural.</p>
          </div>
        </div>

        <!-- Chips de sugerencias -->
        <div class="aw-suggestions" id="awSuggestions">
          <button class="aw-chip" onclick="window._awSend(this.textContent)">Vehículo 001 hoy</button>
          <button class="aw-chip" onclick="window._awSend(this.textContent)">Top conductores mes</button>
          <button class="aw-chip" onclick="window._awSend(this.textContent)">Alertas de hoy</button>
          <button class="aw-chip" onclick="window._awSend(this.textContent)">Estado de la flota</button>
        </div>

        <!-- Input -->
        <div class="aw-input-row">
          <div class="aw-input-wrap">
            <i class="fas fa-comment-dots"></i>
            <textarea
              id="awInput"
              placeholder="Pregunta algo..."
              rows="1"
              aria-label="Mensaje al asistente"
            ></textarea>
          </div>
          <button class="aw-send-btn" id="awSendBtn" aria-label="Enviar">
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>

      </div><!-- /panel -->
    `;
    document.body.appendChild(wrapper);
  }

  // ── Abrir / cerrar panel ───────────────────────────────────
  function togglePanel() {
    isOpen = !isOpen;
    const btn   = document.getElementById('aiFloatBtn');
    const panel = document.getElementById('aiWidgetPanel');

    btn.classList.toggle('open', isOpen);
    panel.classList.toggle('open', isOpen);

    if (isOpen) {
      clearBadge();
      setTimeout(() => {
        const input = document.getElementById('awInput');
        if (input) input.focus();
      }, 280);
    }
  }

  function openPanel() {
    if (!isOpen) togglePanel();
  }

  // ── Badge de no leídos ─────────────────────────────────────
  function showBadge(count) {
    const badge = document.getElementById('aiFloatBadge');
    if (!badge) return;
    badge.textContent = count;
    badge.classList.add('visible');
  }

  function clearBadge() {
    unreadCount = 0;
    const badge = document.getElementById('aiFloatBadge');
    if (badge) badge.classList.remove('visible');
  }

  // ── Hora formateada ────────────────────────────────────────
  function nowTime() {
    return new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  }

  // ── Scroll al último mensaje ───────────────────────────────
  function scrollBottom() {
    const area = document.getElementById('awMessages');
    if (area) area.scrollTop = area.scrollHeight;
  }

  // ── Ocultar bienvenida al primer mensaje ───────────────────
  function hideWelcome() {
    const w = document.getElementById('awWelcome');
    if (w) w.remove();
    const s = document.getElementById('awSuggestions');
    if (s) s.style.display = 'none';
  }

  // ── Agregar mensaje al DOM ─────────────────────────────────
  function appendMsg(role, bubbleHTML, extraHTML = '') {
    hideWelcome();
    const area = document.getElementById('awMessages');
    if (!area) return;

    const row = document.createElement('div');
    row.className = `aw-msg ${role}`;

    const icon = role === 'ai' ? 'fa-robot' : 'fa-user';
    row.innerHTML = `
      <div class="aw-msg-avatar"><i class="fas ${icon}"></i></div>
      <div class="aw-msg-content">
        <div class="aw-bubble">${bubbleHTML}</div>
        ${extraHTML}
        <div class="aw-time">${nowTime()}</div>
      </div>
    `;

    area.appendChild(row);
    scrollBottom();

    // Incrementar badge si el panel está cerrado y el mensaje es de la IA
    if (!isOpen && role === 'ai') {
      unreadCount++;
      showBadge(unreadCount);
    }

    return row;
  }

  // ── Indicador de typing ────────────────────────────────────
  function showTyping() {
    hideWelcome();
    const area = document.getElementById('awMessages');
    if (!area) return;
    const row = document.createElement('div');
    row.className = 'aw-msg ai';
    row.id = 'awTypingRow';
    row.innerHTML = `
      <div class="aw-msg-avatar"><i class="fas fa-robot"></i></div>
      <div class="aw-msg-content">
        <div class="aw-typing"><span></span><span></span><span></span></div>
      </div>
    `;
    area.appendChild(row);
    scrollBottom();
  }

  function hideTyping() {
    const t = document.getElementById('awTypingRow');
    if (t) t.remove();
  }

  // ── Renderizar datos según intención ───────────────────────
  function renderData(intent, data) {
    if (!data) return '';

    if (intent === 'vehicle' && data.vehicle) {
      const v = data.vehicle;
      const kpis = `
        <div class="aw-kpi-grid">
          <div class="aw-kpi"><span class="aw-kpi-lbl">Viajes</span><span class="aw-kpi-val">${v.trips_today}</span></div>
          <div class="aw-kpi"><span class="aw-kpi-lbl">Pasajeros</span><span class="aw-kpi-val green">${v.passengers_today}</span></div>
          <div class="aw-kpi"><span class="aw-kpi-lbl">Recaudación</span><span class="aw-kpi-val gold">S/. ${parseFloat(v.revenue_today).toFixed(2)}</span></div>
          <div class="aw-kpi"><span class="aw-kpi-lbl">Estado</span><span class="aw-kpi-val" style="font-size:0.75rem;text-transform:capitalize">${v.status}</span></div>
        </div>`;

      let table = '';
      if (data.manifests && data.manifests.length > 0) {
        const rows = data.manifests.map(m => `
          <tr>
            <td>${m.manifest_number}</td>
            <td>${m.departure_time ? new Date(m.departure_time).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}) : '—'}</td>
            <td>${m.total_passengers}</td>
            <td>S/. ${parseFloat(m.total_revenue).toFixed(2)}</td>
          </tr>`).join('');
        table = `<div class="aw-table-wrap"><table class="aw-table">
          <thead><tr><th>Manifiesto</th><th>Salida</th><th>Pas.</th><th>Recaud.</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`;
      }
      return kpis + table;
    }

    if (intent === 'revenue' && data.top_drivers && data.top_drivers.length > 0) {
      const rows = data.top_drivers.map((d, i) => `
        <tr><td>${i+1}</td><td>${d.driver_name}</td><td>${d.total_trips}</td><td>S/. ${parseFloat(d.total_revenue).toFixed(2)}</td></tr>`).join('');
      return `<div class="aw-table-wrap"><table class="aw-table">
        <thead><tr><th>#</th><th>Conductor</th><th>Viajes</th><th>Recaud.</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
    }

    if (intent === 'fleet' && data.por_estado) {
      const kpis = data.por_estado.map(s => `
        <div class="aw-kpi"><span class="aw-kpi-lbl">${s.status}</span><span class="aw-kpi-val">${s.total}</span></div>`).join('');
      const gps = data.gps ? `
        <div class="aw-kpi"><span class="aw-kpi-lbl">Con GPS</span><span class="aw-kpi-val green">${data.gps.con_gps}</span></div>
        <div class="aw-kpi"><span class="aw-kpi-lbl">Sin GPS</span><span class="aw-kpi-val">${data.gps.sin_gps}</span></div>` : '';
      return `<div class="aw-kpi-grid">${kpis}${gps}</div>`;
    }

    if (intent === 'alerts' && data.speed_alerts && data.speed_alerts.length > 0) {
      const rows = data.speed_alerts.map(a => `
        <tr><td>${a.association_code}</td><td>${a.driver_name.split(' ')[0]}</td><td>${a.max_speed} km/h</td></tr>`).join('');
      return `<div class="aw-table-wrap"><table class="aw-table">
        <thead><tr><th>Unidad</th><th>Conductor</th><th>Vel. máx.</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
    }

    if (intent === 'queue' && data.queue && data.queue.length > 0) {
      const rows = data.queue.slice(0, 8).map(q => `
        <tr><td>${q.position}</td><td>${q.association_code}</td><td>${q.driver_name.split(' ')[0]}</td><td>${q.status}</td></tr>`).join('');
      return `<div class="aw-table-wrap"><table class="aw-table">
        <thead><tr><th>#</th><th>Unidad</th><th>Conductor</th><th>Estado</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
    }

    if (intent === 'driver' && data.drivers && data.drivers.length > 0) {
      const d = data.drivers[0];
      return `<div class="aw-kpi-grid">
        <div class="aw-kpi"><span class="aw-kpi-lbl">Viajes</span><span class="aw-kpi-val">${d.trips_period}</span></div>
        <div class="aw-kpi"><span class="aw-kpi-lbl">Pasajeros</span><span class="aw-kpi-val green">${d.passengers_period}</span></div>
        <div class="aw-kpi"><span class="aw-kpi-lbl">Recaudación</span><span class="aw-kpi-val gold">S/. ${parseFloat(d.revenue_period).toFixed(2)}</span></div>
      </div>`;
    }

    return '';
  }

  // ── Generar PDF ────────────────────────────────────────────
  function generatePDF(intent, data) {
    const now = new Date().toLocaleString('es-PE');
    let content = '<p>No hay datos para exportar.</p>';

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
        <h2>Reporte de Vehículo ${v.association_code} — ${data.periodo}</h2>
        <table class="info-table">
          <tr><td><b>Unidad:</b> ${v.association_code}</td><td><b>Placa:</b> ${v.plate}</td><td><b>Empresa:</b> ${v.company}</td></tr>
          <tr><td><b>Conductor:</b> ${v.driver_name}</td><td><b>Estado:</b> ${v.status}</td><td></td></tr>
        </table>
        <h3>Resumen del Período</h3>
        <table class="info-table">
          <tr><td><b>Viajes:</b> ${v.trips_today}</td><td><b>Pasajeros:</b> ${v.passengers_today}</td><td><b>Recaudación:</b> S/. ${parseFloat(v.revenue_today).toFixed(2)}</td></tr>
        </table>
        ${manifestRows ? `<h3>Manifiestos</h3>
        <table><thead><tr><th>#</th><th>N° Manifiesto</th><th>Salida</th><th>Pasajeros</th><th>Recaudación</th><th>Estado</th></tr></thead>
        <tbody>${manifestRows}</tbody></table>` : ''}`;
    } else if (intent === 'revenue' && data && data.top_drivers) {
      const rows = data.top_drivers.map((d, i) => `
        <tr><td>${i+1}</td><td>${d.driver_name}</td><td>${d.company}</td><td>${d.total_trips}</td><td>${d.total_passengers}</td><td>S/. ${parseFloat(d.total_revenue).toFixed(2)}</td></tr>`).join('');
      content = `
        <h2>Top Conductores — ${data.periodo || 'Período actual'}</h2>
        <table><thead><tr><th>#</th><th>Conductor</th><th>Empresa</th><th>Viajes</th><th>Pasajeros</th><th>Recaudación</th></tr></thead>
        <tbody>${rows}</tbody></table>`;
    }

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>Reporte CHASKI AI</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:Arial,sans-serif; font-size:12px; color:#111; padding:30px; }
.hdr { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #1D9BD1; padding-bottom:12px; margin-bottom:18px; }
.hdr h1 { font-size:18px; color:#1D9BD1; letter-spacing:.08em; }
.hdr span { font-size:10px; color:#555; text-align:right; }
h2 { font-size:13px; margin-bottom:10px; color:#1D9BD1; }
h3 { font-size:11px; margin:12px 0 6px; color:#333; border-bottom:1px solid #ddd; padding-bottom:3px; }
table { width:100%; border-collapse:collapse; margin-bottom:14px; }
th { background:#f0f7fb; padding:6px 8px; text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:.06em; color:#555; border-bottom:1px solid #ccc; }
td { padding:6px 8px; border-bottom:1px solid #eee; }
.info-table td { border:none; padding:3px 8px; }
.ftr { margin-top:24px; border-top:1px solid #ccc; padding-top:8px; font-size:9px; color:#888; text-align:center; }
</style></head><body>
<div class="hdr"><h1>CHASKI AI — Reporte Operativo</h1><span>Generado: ${now}<br>ATIPCAR · Juli–Puno</span></div>
${content}
<div class="ftr">Generado por Asistente CHASKI AI · ATIPCAR</div>
</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }

  // ── Markdown mínimo ────────────────────────────────────────
  function renderMd(text) {
    return text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,'<em>$1</em>')
      .replace(/`(.+?)`/g,'<code style="background:rgba(255,255,255,0.06);padding:1px 4px;border-radius:3px;font-size:.85em">$1</code>')
      .replace(/^- (.+)$/gm,'• $1')
      .replace(/\n/g,'<br>');
  }

  function escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  }

  // ── Enviar mensaje ─────────────────────────────────────────
  async function sendMessage(text) {
    text = (text || document.getElementById('awInput').value).trim();
    if (!text || isLoading) return;

    const input = document.getElementById('awInput');
    if (input) { input.value = ''; input.style.height = 'auto'; }

    appendMsg('user', escapeHtml(text));
    history.push({ role: 'user', content: text });

    isLoading = true;
    const sendBtn = document.getElementById('awSendBtn');
    if (sendBtn) sendBtn.disabled = true;
    showTyping();

    try {
      const res = await fetch(`${BACKEND_URL}/api/assistant/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: text, history: history.slice(0, -1) }),
      });

      hideTyping();

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        appendMsg('ai', `<span style="color:#ef4444"><i class="fas fa-exclamation-triangle"></i> ${err.error || 'Error del servidor.'}</span>`);
        return;
      }

      const { response, data, action, intent } = await res.json();
      const extraHTML = renderData(intent, data);
      const msgRow   = appendMsg('ai', renderMd(response), extraHTML);

      if (action === 'export_pdf' && msgRow) {
        const card = document.createElement('div');
        card.className = 'aw-export-card';
        card.innerHTML = `
          <div class="aw-export-icon"><i class="fas fa-file-pdf"></i></div>
          <div class="aw-export-info">
            <strong>Reporte listo</strong>
            <span>PDF para impresión</span>
          </div>
          <button class="aw-export-btn" onclick="window._awGeneratePDF('${intent}', ${JSON.stringify(data||null).replace(/'/g,"\\'").replace(/"/g,'&quot;')})">
            <i class="fas fa-download"></i> PDF
          </button>`;
        msgRow.querySelector('.aw-msg-content').appendChild(card);
        scrollBottom();
      }

      history.push({ role: 'assistant', content: response });

    } catch {
      hideTyping();
      appendMsg('ai', `
        <span style="color:#ef4444"><i class="fas fa-wifi"></i> Sin conexión al backend.</span>
        <br><small style="color:#8b949e;font-size:.7rem;display:block;margin-top:4px">
          Inicia: <code style="background:rgba(255,255,255,.06);padding:1px 5px;border-radius:3px">node backend/server.js</code>
        </small>`);
    } finally {
      isLoading = false;
      if (sendBtn) sendBtn.disabled = false;
      const inp = document.getElementById('awInput');
      if (inp) inp.focus();
    }
  }

  // Exponer para uso en onclick de chips y tarjeta PDF
  window._awSend        = sendMessage;
  window._awGeneratePDF = generatePDF;

  // ── Inicializar el widget ──────────────────────────────────
  function init() {
    buildWidget();

    // Event: botón flotante
    document.getElementById('aiFloatBtn').addEventListener('click', togglePanel);

    // Event: botón cerrar dentro del panel
    document.getElementById('awCloseBtn').addEventListener('click', togglePanel);

    // Event: botón enviar
    document.getElementById('awSendBtn').addEventListener('click', () => sendMessage());

    // Event: Enter en el textarea (Shift+Enter = nueva línea)
    const input = document.getElementById('awInput');
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Auto-resize del textarea
    input.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 80) + 'px';
    });

    // Cerrar al hacer clic fuera del panel
    document.addEventListener('click', function (e) {
      const panel = document.getElementById('aiWidgetPanel');
      const btn   = document.getElementById('aiFloatBtn');
      if (isOpen && panel && btn && !panel.contains(e.target) && !btn.contains(e.target)) {
        togglePanel();
      }
    });

    // Abrir automáticamente si la URL tiene ?openAssistant=true
    if (new URLSearchParams(window.location.search).get('openAssistant') === 'true') {
      setTimeout(openPanel, 600);
    }
  }

  // Esperar a que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
