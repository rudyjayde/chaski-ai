'use strict';
// ============================================================
// CHASKI AI 2.0 — AI Decision Engine
// Motor de análisis inteligente para la cola de salida
// ============================================================
const https = require('https');
const pool  = require('../config/db');

// ── Constantes de negocio ────────────────────────────────────
const ROUTES         = ['juli-puno', 'puno-juli'];
const AVG_TRIP_MIN   = 45;   // Duración promedio Juli↔Puno
const MIN_BUFFER     = 2;    // Vehículos mínimos antes de alertar
const RISK_WINDOW    = 30;   // Minutos de ventana para predicción

// ── Llamada a Claude API (https nativo, sin SDK externo) ──────
async function callClaude(systemPrompt, userPrompt) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  return new Promise((resolve) => {
    const body = JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    });

    const opts = {
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers:  {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length':    Buffer.byteLength(body),
      },
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed?.content?.[0]?.text || null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

// ── Recolectar estado actual del sistema ──────────────────────
async function gatherSystemState() {
  const today = new Date().toISOString().split('T')[0];

  const [queueRes, tripsRes, histRes, passengerRes] = await Promise.all([
    // Estado de la cola por ruta
    pool.query(`
      SELECT qe.route,
             qe.position,
             qe.registered_at,
             qe.departure_at,
             d.first_name || ' ' || d.last_name AS driver_name,
             v.association_code                  AS vehicle_code
        FROM queue_entries qe
        JOIN drivers d  ON d.id = qe.driver_id
        LEFT JOIN vehicles v ON v.id = qe.vehicle_id
       WHERE qe.queue_date = $1 AND qe.active = TRUE
       ORDER BY qe.route, qe.turn_number
    `, [today]),

    // Viajes activos y completados hoy
    pool.query(`
      SELECT t.id, t.status, t.start_time, t.end_time, t.revenue,
             r.slug AS route, m.total_passengers
        FROM trips t
        JOIN routes r ON r.id = t.route_id
        LEFT JOIN manifests m ON m.id = t.manifest_id
       WHERE DATE(t.start_time) = $1
    `, [today]),

    // Historial de duración promedio de viajes (últimos 30 días)
    pool.query(`
      SELECT r.slug AS route,
             AVG(EXTRACT(EPOCH FROM (t.end_time - t.start_time)) / 60) AS avg_min,
             COUNT(*) AS trip_count
        FROM trips t
        JOIN routes r ON r.id = t.route_id
       WHERE t.status = 'completed'
         AND t.end_time IS NOT NULL
         AND t.start_time >= NOW() - INTERVAL '30 days'
       GROUP BY r.slug
    `),

    // Pasajeros por hora hoy (para detectar demanda)
    pool.query(`
      SELECT EXTRACT(HOUR FROM m.departure_time) AS hour,
             r.slug AS route,
             SUM(m.total_passengers) AS passengers
        FROM manifests m
        JOIN routes r ON r.id = m.route_id
       WHERE DATE(m.departure_time) = $1
       GROUP BY EXTRACT(HOUR FROM m.departure_time), r.slug
    `, [today]),
  ]);

  const now    = new Date();
  const nowHr  = now.getHours();
  const entries = queueRes.rows;
  const trips   = tripsRes.rows;
  const hist    = histRes.rows;
  const paxHours = passengerRes.rows;

  // Duración promedio por ruta (o constante por defecto)
  const avgMinByRoute = {};
  hist.forEach(r => { avgMinByRoute[r.route] = parseFloat(r.avg_min) || AVG_TRIP_MIN; });

  // Estado agregado por ruta
  const byRoute = {};
  ROUTES.forEach(route => {
    const routeEntries = entries.filter(e => e.route === route);
    const routeTrips   = trips.filter(t => t.route === route);
    const avgMin       = avgMinByRoute[route] || AVG_TRIP_MIN;

    const available  = routeEntries.filter(e => !['departed','cancelled'].includes(e.position)).length;
    const departed   = routeEntries.filter(e => e.position === 'departed').length;
    const inTransit  = routeTrips.filter(t => t.status === 'active').length;
    const callingNow = routeEntries.find(e => e.position === 'calling');

    // Estimar retornos en los próximos RISK_WINDOW minutos
    const activeTrips      = routeTrips.filter(t => t.status === 'active');
    const returningIn30min = activeTrips.filter(t => {
      const elapsed = (now - new Date(t.start_time)) / 60000;
      return elapsed + RISK_WINDOW >= avgMin;
    }).length;

    // Minutos estimados hasta quedarse sin vehículos
    let minutesUntilShortage = null;
    if (available > 0 && inTransit === 0) {
      minutesUntilShortage = null; // sin viajes, no hay retorno esperado
    } else if (available === 0 && inTransit === 0) {
      minutesUntilShortage = 0;
    } else if (available === 0 && inTransit > 0) {
      const firstActive = activeTrips.sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0];
      if (firstActive) {
        const elapsed = (now - new Date(firstActive.start_time)) / 60000;
        minutesUntilShortage = Math.max(0, avgMin - elapsed);
      }
    }

    // Total pasajeros hoy
    const todayPax = paxHours.filter(p => p.route === route).reduce((s, p) => s + parseInt(p.passengers), 0);

    byRoute[route] = {
      route,
      available,
      departed,
      inTransit,
      callingUnit: callingNow?.vehicle_code || null,
      avgTripMin:  Math.round(avgMin),
      returningIn30min,
      minutesUntilShortage: minutesUntilShortage !== null ? Math.round(minutesUntilShortage) : null,
      totalPassengersToday:  todayPax,
      entries: routeEntries,
      activeTrips,
    };
  });

  return {
    timestamp: now,
    hour:      nowHr,
    dayOfWeek: now.getDay(),
    byRoute,
    totalVehiclesActive: Object.values(byRoute).reduce((s, r) => s + r.inTransit, 0),
    totalPaxToday: Object.values(byRoute).reduce((s, r) => s + r.totalPassengersToday, 0),
  };
}

// ── Calcular nivel de riesgo ──────────────────────────────────
function calculateRisk(routeState) {
  const { available, inTransit, minutesUntilShortage, returningIn30min } = routeState;
  const totalProjected = available + returningIn30min;

  if (available === 0 && inTransit === 0)          return 'critico';
  if (available === 0 && minutesUntilShortage > 20) return 'alto';
  if (available === 0)                              return 'alto';
  if (totalProjected <= MIN_BUFFER)                return 'alto';
  if (available <= MIN_BUFFER)                     return 'medio';
  if (available <= 4)                              return 'bajo';
  return 'normal';
}

// ── Generar predicciones ──────────────────────────────────────
function buildPredictions(state) {
  return ROUTES.map(route => {
    const r    = state.byRoute[route];
    const risk = calculateRisk(r);
    return {
      route,
      riskLevel:           risk,
      vehiclesAvailable:   r.available,
      vehiclesInRoute:     r.inTransit,
      returningIn30min:    r.returningIn30min,
      minutesUntilShortage: r.minutesUntilShortage,
      estimatedPaxToday:   r.totalPassengersToday,
      avgTripMin:          r.avgTripMin,
    };
  });
}

// ── Generar recomendaciones ───────────────────────────────────
function buildRecommendations(state) {
  const recs = [];
  ROUTES.forEach(route => {
    const r    = state.byRoute[route];
    const risk = calculateRisk(r);
    const label = route === 'juli-puno' ? 'Juli → Puno' : 'Puno → Juli';

    if (risk === 'critico') {
      recs.push({
        type:       'open_registration',
        route,
        message:    `⚠️ Sin vehículos en ${label}. Abrir inscripciones inmediatamente.`,
        priority:   'critical',
        confidence: 0.99,
      });
    }
    if (risk === 'alto') {
      recs.push({
        type:       'open_registration',
        route,
        message:    `🔴 Solo ${r.available} vehículo(s) disponible(s) en ${label}. Se recomienda abrir inscripciones anticipadas.`,
        priority:   'high',
        confidence: 0.92,
      });
    }
    if (risk === 'medio') {
      recs.push({
        type:       'monitor',
        route,
        message:    `🟡 ${r.available} vehículos disponibles en ${label}. Monitorear la demanda en los próximos 30 minutos.`,
        priority:   'medium',
        confidence: 0.78,
      });
    }
    if (r.inTransit > 0 && r.available === 0) {
      const eta = r.minutesUntilShortage;
      recs.push({
        type:       'eta_alert',
        route,
        message:    `⏱ El próximo vehículo en ${label} llegará aprox. en ${eta ?? '?'} minutos.`,
        priority:   'high',
        confidence: 0.85,
      });
    }
    if (r.totalPassengersToday > 50) {
      recs.push({
        type:       'high_demand',
        route,
        message:    `📈 Alta demanda en ${label}: ${r.totalPassengersToday} pasajeros hoy. Evaluar más frecuencias.`,
        priority:   'medium',
        confidence: 0.70,
      });
    }
  });
  return recs;
}

// ── Generar alertas ───────────────────────────────────────────
function buildAlerts(state) {
  const alerts = [];
  ROUTES.forEach(route => {
    const r    = state.byRoute[route];
    const risk = calculateRisk(r);
    const label = route === 'juli-puno' ? 'Juli → Puno' : 'Puno → Juli';

    if (r.available === 0 && r.inTransit === 0) {
      alerts.push({ type: 'no_vehicles', severity: 'critical', route,
        message: `No hay vehículos disponibles ni en ruta para ${label}.` });
    } else if (r.available === 0) {
      alerts.push({ type: 'scarcity', severity: 'high', route,
        message: `Sin vehículos disponibles en terminal ${label}. ${r.inTransit} en ruta.` });
    }
    if (risk === 'alto' || risk === 'critico') {
      alerts.push({ type: 'low_supply', severity: risk === 'critico' ? 'critical' : 'high', route,
        message: `Riesgo ${risk.toUpperCase()} en ${label}: solo ${r.available} vehículo(s) disponible(s).` });
    }
    // Conductor tardando demasiado (más del doble del promedio)
    const overdue = r.activeTrips.filter(t => {
      const elapsed = (state.timestamp - new Date(t.start_time)) / 60000;
      return elapsed > r.avgTripMin * 2;
    });
    if (overdue.length > 0) {
      alerts.push({ type: 'delay', severity: 'medium', route,
        message: `${overdue.length} vehículo(s) en ${label} llevan más del doble del tiempo promedio en ruta.` });
    }
  });
  return alerts;
}

// ── Tomar decisiones automáticas ─────────────────────────────
async function makeDecisions(state, predictions) {
  const decisions = [];

  for (const pred of predictions) {
    const r     = state.byRoute[pred.route];
    const label = pred.route === 'juli-puno' ? 'Juli → Puno' : 'Puno → Juli';
    const risk  = pred.riskLevel;

    if (risk === 'alto' || risk === 'critico') {
      // Verificar si ya se tomó esta decisión hoy (evitar duplicados)
      const recent = await pool.query(`
        SELECT id FROM ai_decisions
        WHERE decision_type = 'open_registration'
          AND route = $1
          AND created_at > NOW() - INTERVAL '2 hours'
      `, [pred.route]);

      if (!recent.rows.length) {
        const contextSnap = {
          available:    r.available,
          inRoute:      r.inTransit,
          avgTripMin:   r.avgTripMin,
          returning30:  r.returningIn30min,
          etsShortage:  r.minutesUntilShortage,
          hour:         state.hour,
        };

        // Solicitar explicación a Claude
        const explanation = await callClaude(
          'Eres el motor de decisiones de Chaski AI, sistema de gestión de transporte Juli-Puno. ' +
          'Explica en 2-3 oraciones en español, de forma directa y operativa, por qué se tomó esta decisión. ' +
          'No uses asteriscos ni formato markdown.',
          `Decisión: Apertura anticipada de inscripciones en ${label}\n` +
          `Contexto: ${r.available} vehículo(s) disponible(s), ${r.inTransit} en ruta, ` +
          `duración promedio ${r.avgTripMin} min, ${r.returningIn30min} retornos esperados en 30 min, ` +
          `riesgo ${risk}, hora actual ${state.hour}:00.`
        );

        const reason = `Riesgo ${risk}: ${r.available} vehículo(s) disponible(s), ${r.inTransit} en ruta.`;

        await pool.query(`
          INSERT INTO ai_decisions (decision_type, route, action_taken, reason, ai_explanation, context_snapshot)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, ['open_registration', pred.route, true, reason, explanation, JSON.stringify(contextSnap)]);

        // Notificar al admin via tabla de notificaciones
        await pool.query(`
          INSERT INTO notifications (type, title, body, target_role, created_at)
          VALUES ('alert', $1, $2, 'admin', NOW())
          ON CONFLICT DO NOTHING
        `, [
          `⚠️ IA abrió inscripciones en ${label}`,
          explanation || reason,
        ]).catch(() => {}); // silenciar si no existe la tabla

        decisions.push({ type: 'open_registration', route: pred.route, explanation, risk });
        console.log(`[AI Engine] Decisión: abrir inscripciones en ${pred.route} — ${risk}`);
      }
    }
  }

  return decisions;
}

// ── Persistir predicciones y alertas ─────────────────────────
async function persistAnalysis(predictions, alerts, recommendations) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Predicciones (upsert por hora)
    for (const p of predictions) {
      await client.query(`
        INSERT INTO ai_predictions
          (route, risk_level, vehicles_available, vehicles_in_route,
           minutes_until_shortage, estimated_demand, prediction_for)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [p.route, p.riskLevel, p.vehiclesAvailable, p.vehiclesInRoute,
          p.minutesUntilShortage, p.estimatedPaxToday]);
    }

    // Alertas: resolver las anteriores no activas, insertar nuevas
    await client.query(`
      UPDATE ai_alerts SET resolved = TRUE, resolved_at = NOW()
       WHERE resolved = FALSE
         AND created_at < NOW() - INTERVAL '10 minutes'
    `);

    for (const a of alerts) {
      // Solo insertar si no hay una igual activa en los últimos 30 min
      const dup = await client.query(`
        SELECT id FROM ai_alerts
         WHERE alert_type = $1 AND route = $2 AND resolved = FALSE
           AND created_at > NOW() - INTERVAL '30 minutes'
      `, [a.type, a.route]);
      if (!dup.rows.length) {
        await client.query(`
          INSERT INTO ai_alerts (alert_type, severity, route, message)
          VALUES ($1, $2, $3, $4)
        `, [a.type, a.severity, a.route, a.message]);
      }
    }

    // Recomendaciones: borrar las pendientes anteriores e insertar nuevas
    await client.query(`
      DELETE FROM ai_recommendations WHERE status = 'pending'
    `);
    for (const r of recommendations) {
      await client.query(`
        INSERT INTO ai_recommendations (recommendation_type, route, message, priority, confidence)
        VALUES ($1, $2, $3, $4, $5)
      `, [r.type, r.route, r.message, r.priority, r.confidence]);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[AI Engine] Error al persistir análisis:', err.message);
  } finally {
    client.release();
  }
}

// ── Actualizar historial diario ───────────────────────────────
async function updateDailyHistory() {
  const today = new Date().toISOString().split('T')[0];
  const hour  = new Date().getHours();

  await pool.query(`
    INSERT INTO ai_history (date, hour, route, trips_count, passengers_count, avg_duration_min, total_revenue)
    SELECT
      DATE(t.start_time) AS date,
      EXTRACT(HOUR FROM t.start_time)::int AS hour,
      r.slug AS route,
      COUNT(*)::int AS trips_count,
      COALESCE(SUM(m.total_passengers), 0)::int AS passengers_count,
      AVG(EXTRACT(EPOCH FROM (t.end_time - t.start_time)) / 60) AS avg_duration_min,
      COALESCE(SUM(t.revenue), 0) AS total_revenue
    FROM trips t
    JOIN routes r ON r.id = t.route_id
    LEFT JOIN manifests m ON m.id = t.manifest_id
    WHERE DATE(t.start_time) = $1
      AND EXTRACT(HOUR FROM t.start_time)::int = $2
    GROUP BY DATE(t.start_time), EXTRACT(HOUR FROM t.start_time), r.slug
    ON CONFLICT (date, hour, route) DO UPDATE
      SET trips_count      = EXCLUDED.trips_count,
          passengers_count = EXCLUDED.passengers_count,
          avg_duration_min = EXCLUDED.avg_duration_min,
          total_revenue    = EXCLUDED.total_revenue
  `, [today, hour]).catch(e => console.warn('[AI Engine] history upsert:', e.message));
}

// ── Análisis completo (punto de entrada principal) ────────────
async function runAnalysis() {
  try {
    console.log('[AI Engine] Iniciando análisis del sistema...');
    const state           = await gatherSystemState();
    const predictions     = buildPredictions(state);
    const recommendations = buildRecommendations(state);
    const alerts          = buildAlerts(state);
    const decisions       = await makeDecisions(state, predictions);

    await persistAnalysis(predictions, alerts, recommendations);
    await updateDailyHistory();

    console.log(`[AI Engine] Análisis completado — ${predictions.length} predicciones, ` +
                `${alerts.length} alertas, ${decisions.length} decisiones`);

    return { state, predictions, recommendations, alerts, decisions };
  } catch (err) {
    console.error('[AI Engine] Error en análisis:', err.message);
    return null;
  }
}

// ── Scheduler (cada 5 minutos) ────────────────────────────────
let _schedulerRunning = false;

function startScheduler() {
  if (_schedulerRunning) return;
  _schedulerRunning = true;

  // Primera ejecución tras 10 s de arranque
  setTimeout(runAnalysis, 10_000);

  // Luego cada 5 minutos
  setInterval(runAnalysis, 5 * 60 * 1000);
  console.log('[AI Engine] Scheduler iniciado — análisis cada 5 minutos');
}

module.exports = { runAnalysis, startScheduler, gatherSystemState, calculateRisk, callClaude };
