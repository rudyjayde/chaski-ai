'use strict';
/* ============================================================
   Chaski AI — AI Dashboard Frontend
   Panel de visualización del Motor de Decisiones IA
   ============================================================ */

const AI_API = '/api/ai';
let _refreshInterval = null;

// ── Reloj ─────────────────────────────────────────────────────
setInterval(() => {
  const el = document.getElementById('clockDisplay');
  if (el) el.textContent = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}, 1000);

// ── Sidebar toggle ────────────────────────────────────────────
document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar')?.classList.toggle('open');
});

// ── Disparar análisis manual ──────────────────────────────────
async function triggerAnalysis() {
  const btn = document.getElementById('runBtn');
  if (!btn) return;
  btn.disabled   = true;
  btn.innerHTML  = '<i class="fas fa-spinner fa-spin"></i> Analizando…';

  try {
    await authFetch(`${AI_API}/run`, { method: 'POST' });
    // Esperar 3 s y recargar (el análisis corre en background)
    setTimeout(async () => {
      await loadDashboard();
      btn.disabled  = false;
      btn.innerHTML = '<i class="fas fa-play"></i> Analizar ahora';
    }, 3000);
  } catch {
    btn.disabled  = false;
    btn.innerHTML = '<i class="fas fa-play"></i> Analizar ahora';
  }
}
window.triggerAnalysis = triggerAnalysis;

// ── Helpers de formato ────────────────────────────────────────
function timeAgo(isoStr) {
  if (!isoStr) return '—';
  const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
  if (diff < 60)    return 'hace un momento';
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return new Date(isoStr).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
}

const SEV_ICONS = { critical: 'fa-radiation', high: 'fa-exclamation-triangle', medium: 'fa-exclamation-circle', low: 'fa-info-circle' };
const SEV_LABEL = { critical: 'CRÍTICO', high: 'ALTO', medium: 'MEDIO', low: 'BAJO' };
const RISK_ES   = { critico: 'CRÍTICO', alto: 'ALTO', medio: 'MEDIO', bajo: 'BAJO', normal: 'NORMAL' };
const DEC_LABEL = { open_registration: 'Apertura de cola', monitor: 'Monitoreo', eta_alert: 'Alerta ETA', high_demand: 'Alta demanda' };

// ── Actualizar tarjeta de riesgo global ───────────────────────
function renderRisk(overallRisk, lastAnalysis) {
  const card    = document.getElementById('riskCard');
  const valEl   = document.getElementById('riskValue');
  const lblEl   = document.getElementById('riskLabel');
  const timeEl  = document.getElementById('lastAnalysisTime');

  ['risk-normal','risk-bajo','risk-medio','risk-alto','risk-critico'].forEach(c => card.classList.remove(c));
  card.classList.add(`risk-${overallRisk || 'normal'}`);

  if (valEl) valEl.textContent  = RISK_ES[overallRisk] || '—';
  if (lblEl) lblEl.textContent  = {
    normal:  'Sistema operando con normalidad',
    bajo:    'Situación controlada — monitorear',
    medio:   'Atención recomendada',
    alto:    'Riesgo elevado — acción requerida',
    critico: '¡ACCIÓN INMEDIATA REQUERIDA!',
  }[overallRisk] || '';
  if (timeEl) timeEl.textContent = timeAgo(lastAnalysis);
}

// ── Renderizar tarjeta de ruta ─────────────────────────────────
function renderRouteCard(route) {
  const suffix = route.route === 'juli-puno' ? 'JP' : 'PJ';
  const riskBadge = document.getElementById(`risk${suffix === 'JP' ? 'JuliPuno' : 'PunoJuli'}`);

  if (riskBadge) {
    riskBadge.textContent = RISK_ES[route.riskLevel] || route.riskLevel;
    riskBadge.className   = `ai-risk-badge badge-${route.riskLevel}`;
  }

  const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  set(`available${suffix}`, route.vehiclesAvailable ?? '—');
  set(`inRoute${suffix}`,   route.vehiclesInRoute   ?? '—');
  set(`eta${suffix}`,       route.minutesUntilShortage != null
    ? `~${route.minutesUntilShortage} min`
    : route.returningIn30min > 0 ? `< 30 min (${route.returningIn30min})` : '—');
  set(`pax${suffix}`,       route.passengersToday   ?? '—');

  const callingBar  = document.getElementById(`calling${suffix}`);
  const callingUnit = document.getElementById(`callingUnit${suffix}`);
  if (callingBar) callingBar.style.display = route.callingUnit ? 'block' : 'none';
  if (callingUnit) callingUnit.textContent = route.callingUnit || '';
}

// ── Renderizar alertas ────────────────────────────────────────
function renderAlerts(alerts) {
  const list  = document.getElementById('alertsList');
  const count = document.getElementById('alertCount');
  if (!list) return;
  if (count) count.textContent = alerts.length;

  if (!alerts.length) {
    list.innerHTML = `<div class="ai-empty"><i class="fas fa-check-circle"></i> Sin alertas activas</div>`;
    return;
  }

  list.innerHTML = alerts.map(a => `
    <div class="ai-alert-item sev-${a.severity}" id="alert-${a.id}">
      <div class="ai-alert-icon"><i class="fas ${SEV_ICONS[a.severity] || 'fa-bell'}"></i></div>
      <div class="ai-alert-body">
        <div class="ai-alert-msg">${a.message}</div>
        <div class="ai-alert-meta">
          ${a.route ? `<span><i class="fas fa-route"></i> ${a.route === 'juli-puno' ? 'Juli → Puno' : 'Puno → Juli'}</span>` : ''}
          <span><i class="fas fa-clock"></i> ${timeAgo(a.created_at)}</span>
        </div>
      </div>
      <button class="ai-alert-resolve" onclick="resolveAlert('${a.id}')" title="Resolver">
        <i class="fas fa-times"></i>
      </button>
    </div>`).join('');
}

// ── Renderizar recomendaciones ────────────────────────────────
function renderRecommendations(recs) {
  const list  = document.getElementById('recsList');
  const count = document.getElementById('recCount');
  if (!list) return;
  if (count) count.textContent = recs.length;

  if (!recs.length) {
    list.innerHTML = `<div class="ai-empty"><i class="fas fa-robot"></i> Sin recomendaciones pendientes</div>`;
    return;
  }

  list.innerHTML = recs.map(r => `
    <div class="ai-rec-item prio-${r.priority}" id="rec-${r.id}">
      <div class="ai-rec-body">
        <div class="ai-rec-msg">${r.message}</div>
        <div class="ai-rec-meta">
          ${r.route ? `<span><i class="fas fa-road"></i> ${r.route === 'juli-puno' ? 'Juli→Puno' : 'Puno→Juli'}</span>` : ''}
          <span><i class="fas fa-percentage"></i> Confianza: ${Math.round((r.confidence || 0) * 100)}%</span>
          <span><i class="fas fa-clock"></i> ${timeAgo(r.created_at)}</span>
        </div>
        <div class="ai-rec-actions">
          <button class="ai-rec-btn accept"  onclick="actOnRec('${r.id}','accepted')">
            <i class="fas fa-check"></i> Aplicar
          </button>
          <button class="ai-rec-btn dismiss" onclick="actOnRec('${r.id}','dismissed')">
            <i class="fas fa-times"></i> Ignorar
          </button>
        </div>
      </div>
    </div>`).join('');
}

// ── Renderizar decisiones IA ──────────────────────────────────
function renderDecisions(decisions) {
  const list = document.getElementById('decisionsList');
  if (!list) return;

  if (!decisions.length) {
    list.innerHTML = `<div class="ai-empty"><i class="fas fa-clock"></i> Sin decisiones registradas aún</div>`;
    return;
  }

  list.innerHTML = decisions.map(d => `
    <div class="ai-decision-item">
      <div class="ai-decision-header">
        <span class="ai-decision-type">${DEC_LABEL[d.decision_type] || d.decision_type}</span>
        ${d.route ? `<span class="ai-decision-route"><i class="fas fa-route"></i> ${d.route === 'juli-puno' ? 'Juli → Puno' : 'Puno → Juli'}</span>` : ''}
        <span class="ai-decision-time">${timeAgo(d.created_at)}</span>
      </div>
      ${d.reason ? `<div class="ai-decision-reason"><i class="fas fa-info-circle"></i> ${d.reason}</div>` : ''}
      ${d.ai_explanation ? `
        <div class="ai-claude-tag"><i class="fas fa-robot"></i> Explicación de Claude</div>
        <div class="ai-decision-explanation">${d.ai_explanation}</div>
      ` : ''}
    </div>`).join('');
}

// ── Renderizar historial / horas pico ────────────────────────
function renderHistory(peakHours, historyData) {
  const peakList = document.getElementById('peakHoursList');
  if (peakList && peakHours?.length) {
    const max    = peakHours[0]?.avgPassengers || 1;
    const medals = ['🥇', '🥈', '🥉'];
    peakList.innerHTML = peakHours.slice(0, 3).map((p, i) => `
      <div class="ai-peak-item">
        <span class="ai-peak-medal">${medals[i]}</span>
        <span class="ai-peak-hour">${String(p.hour).padStart(2,'0')}:00</span>
        <div class="ai-peak-bar-wrap">
          <div class="ai-peak-bar" style="width:${Math.round((p.avgPassengers/max)*100)}%;
               background:${['#6366F1','#8B5CF6','#A78BFA'][i]}"></div>
        </div>
        <span class="ai-peak-pax">${p.avgPassengers} pax</span>
      </div>`).join('');
  } else if (peakList) {
    peakList.innerHTML = `<div class="ai-empty" style="padding:12px"><i class="fas fa-chart-bar"></i> Sin datos suficientes</div>`;
  }

  // Gráfico de barras por hora (24h)
  const chart = document.getElementById('demandChart');
  if (!chart || !historyData) return;

  // Agregar pasajeros por hora (todas las rutas, todos los días en el historial)
  const hourPax = Array(24).fill(0);
  Object.values(historyData).forEach(dayArr => {
    dayArr.forEach(r => {
      const h = parseInt(r.hour);
      if (h >= 0 && h < 24) hourPax[h] += parseInt(r.passengers_count) || 0;
    });
  });

  const maxPax = Math.max(...hourPax, 1);
  const workHours = hourPax.map((p, h) => ({ h, p })).filter(x => x.h >= 5 && x.h <= 22);

  chart.innerHTML = workHours.map(({ h, p }) => `
    <div class="ai-bar-col">
      <div class="ai-bar-fill" style="height:${Math.max(2, Math.round((p/maxPax)*68))}px;
           opacity:${p > 0 ? 1 : 0.2}"></div>
      <div class="ai-bar-lbl">${h}</div>
    </div>`).join('');
}

// ── Cargar dashboard completo ─────────────────────────────────
async function loadDashboard() {
  try {
    const [dashRes, recRes, decRes, histRes] = await Promise.all([
      authFetch(`${AI_API}/dashboard`),
      authFetch(`${AI_API}/recommendations`),
      authFetch(`${AI_API}/decisions`),
      authFetch(`${AI_API}/history?days=7`),
    ]);

    if (!dashRes.ok) return;
    const dash = await dashRes.json();
    const recs = recRes.ok  ? (await recRes.json()).recommendations  : [];
    const decs = decRes.ok  ? (await decRes.json()).decisions         : [];
    const hist = histRes.ok ? await histRes.json()                    : {};

    renderRisk(dash.overallRisk, dash.lastAnalysis);

    (dash.routes || []).forEach(r => renderRouteCard(r));
    renderAlerts(dash.activeAlerts || []);
    renderRecommendations(recs);
    renderDecisions(decs);
    renderHistory(hist.peakHours, hist.history);

    // Parpadear indicador EN VIVO
    const dot = document.getElementById('liveDot');
    if (dot) {
      dot.style.opacity = '0.4';
      setTimeout(() => { dot.style.opacity = '1'; }, 200);
    }

  } catch (err) {
    console.warn('[AI Dashboard] Error al cargar:', err.message);
  }
}

// ── Resolver alerta ───────────────────────────────────────────
async function resolveAlert(id) {
  await authFetch(`${AI_API}/alerts/${id}/resolve`, { method: 'PUT' }).catch(() => {});
  document.getElementById(`alert-${id}`)?.remove();
  const count = document.getElementById('alertCount');
  if (count) count.textContent = Math.max(0, parseInt(count.textContent) - 1);
}
window.resolveAlert = resolveAlert;

// ── Actuar sobre recomendación ────────────────────────────────
async function actOnRec(id, status) {
  await authFetch(`${AI_API}/recommendations/${id}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ status }),
  }).catch(() => {});
  document.getElementById(`rec-${id}`)?.remove();
  const count = document.getElementById('recCount');
  if (count) count.textContent = Math.max(0, parseInt(count.textContent) - 1);
}
window.actOnRec = actOnRec;

// ── Inicializar ───────────────────────────────────────────────
loadDashboard();
_refreshInterval = setInterval(loadDashboard, 60_000);
