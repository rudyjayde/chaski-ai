'use strict';
// ============================================================
// CHASKI AI 2.0 — AI Decision Engine API
//
// GET  /api/ai/dashboard       → estado completo + riesgo
// GET  /api/ai/recommendations → recomendaciones activas
// GET  /api/ai/predictions     → predicciones de escasez
// GET  /api/ai/alerts          → alertas activas
// GET  /api/ai/history         → historial de patrones
// GET  /api/ai/decisions       → últimas decisiones de la IA
// POST /api/ai/run             → disparar análisis manual
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { runAnalysis, gatherSystemState, calculateRisk, callClaude } = require('../services/aiEngine');

// ── Auto-crear tablas si no existen ──────────────────────────
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_decisions (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        decision_type    VARCHAR(50) NOT NULL,
        route            VARCHAR(20),
        action_taken     BOOLEAN DEFAULT FALSE,
        reason           TEXT,
        ai_explanation   TEXT,
        context_snapshot JSONB,
        created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_alerts (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        alert_type  VARCHAR(50) NOT NULL,
        severity    VARCHAR(20) NOT NULL DEFAULT 'medium',
        route       VARCHAR(20),
        message     TEXT NOT NULL,
        resolved    BOOLEAN DEFAULT FALSE,
        resolved_at TIMESTAMP WITH TIME ZONE,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_predictions (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        route                 VARCHAR(20) NOT NULL,
        risk_level            VARCHAR(20) NOT NULL,
        vehicles_available    INTEGER DEFAULT 0,
        vehicles_in_route     INTEGER DEFAULT 0,
        minutes_until_shortage INTEGER,
        estimated_demand      INTEGER DEFAULT 0,
        prediction_for        TIMESTAMP WITH TIME ZONE,
        created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_recommendations (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recommendation_type VARCHAR(50) NOT NULL,
        route               VARCHAR(20),
        message             TEXT NOT NULL,
        priority            VARCHAR(20) DEFAULT 'medium',
        confidence          NUMERIC(3,2) DEFAULT 0.75,
        status              VARCHAR(20) DEFAULT 'pending',
        created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_history (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date             DATE NOT NULL,
        hour             INTEGER,
        route            VARCHAR(20),
        trips_count      INTEGER DEFAULT 0,
        passengers_count INTEGER DEFAULT 0,
        avg_duration_min NUMERIC,
        total_revenue    NUMERIC DEFAULT 0,
        created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(date, hour, route)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_alerts_resolved   ON ai_alerts(resolved, created_at)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_decisions_created ON ai_decisions(created_at)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_history_date      ON ai_history(date, hour, route)`);
    console.log('[AI] Tablas de inteligencia listas');
  } catch (err) {
    console.error('[AI] Error al crear tablas:', err.message);
  }
})();

// ── GET /api/ai/dashboard ─────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const state = await gatherSystemState();

    const routes = Object.entries(state.byRoute).map(([route, r]) => ({
      route,
      label:               route === 'juli-puno' ? 'Juli → Puno' : 'Puno → Juli',
      riskLevel:           calculateRisk(r),
      vehiclesAvailable:   r.available,
      vehiclesInRoute:     r.inTransit,
      vehiclesDeparted:    r.departed,
      returningIn30min:    r.returningIn30min,
      minutesUntilShortage: r.minutesUntilShortage,
      avgTripMin:          r.avgTripMin,
      callingUnit:         r.callingUnit,
      passengersToday:     r.totalPassengersToday,
    }));

    // Última predicción guardada
    const lastPredRes = await pool.query(`
      SELECT route, risk_level, created_at
        FROM ai_predictions
       ORDER BY created_at DESC LIMIT 2
    `);

    // Alertas activas
    const alertsRes = await pool.query(`
      SELECT id, alert_type, severity, route, message, created_at
        FROM ai_alerts
       WHERE resolved = FALSE
       ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2
                              WHEN 'medium' THEN 3 ELSE 4 END,
                created_at DESC
       LIMIT 10
    `);

    // Última decisión
    const decRes = await pool.query(`
      SELECT decision_type, route, reason, ai_explanation, created_at
        FROM ai_decisions
       ORDER BY created_at DESC LIMIT 1
    `);

    const overallRisk = routes.reduce((worst, r) => {
      const order = { critico: 4, alto: 3, medio: 2, bajo: 1, normal: 0 };
      return (order[r.riskLevel] || 0) > (order[worst] || 0) ? r.riskLevel : worst;
    }, 'normal');

    res.json({
      ok: true,
      timestamp:       state.timestamp,
      overallRisk,
      routes,
      activeAlerts:    alertsRes.rows,
      lastPredictions: lastPredRes.rows,
      lastDecision:    decRes.rows[0] || null,
      totalPaxToday:   state.totalPaxToday,
      lastAnalysis:    lastPredRes.rows[0]?.created_at || null,
    });
  } catch (err) {
    console.error('[AI dashboard]', err.message);
    res.status(500).json({ error: 'Error al obtener dashboard de IA' });
  }
});

// ── GET /api/ai/recommendations ───────────────────────────────
router.get('/recommendations', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, recommendation_type, route, message, priority, confidence, status, created_at
        FROM ai_recommendations
       WHERE status = 'pending'
       ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2
                              WHEN 'medium' THEN 3 ELSE 4 END,
                created_at DESC
    `);
    res.json({ ok: true, recommendations: rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener recomendaciones' });
  }
});

// ── PUT /api/ai/recommendations/:id ──────────────────────────
// Marcar como aceptada o descartada
router.put('/recommendations/:id', async (req, res) => {
  const { status } = req.body; // 'accepted' | 'dismissed'
  if (!['accepted', 'dismissed'].includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  await pool.query(`UPDATE ai_recommendations SET status = $1 WHERE id = $2`, [status, req.params.id]);
  res.json({ ok: true });
});

// ── GET /api/ai/predictions ───────────────────────────────────
router.get('/predictions', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT ON (route)
             id, route, risk_level, vehicles_available, vehicles_in_route,
             minutes_until_shortage, estimated_demand, created_at
        FROM ai_predictions
       ORDER BY route, created_at DESC
    `);
    res.json({ ok: true, predictions: rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener predicciones' });
  }
});

// ── GET /api/ai/alerts ────────────────────────────────────────
router.get('/alerts', async (req, res) => {
  try {
    const showAll = req.query.all === 'true';
    const { rows } = await pool.query(`
      SELECT id, alert_type, severity, route, message, resolved, resolved_at, created_at
        FROM ai_alerts
       ${showAll ? '' : 'WHERE resolved = FALSE'}
       ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2
                              WHEN 'medium' THEN 3 ELSE 4 END,
                created_at DESC
       LIMIT 50
    `);
    res.json({ ok: true, alerts: rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener alertas' });
  }
});

// ── PUT /api/ai/alerts/:id/resolve ───────────────────────────
router.put('/alerts/:id/resolve', async (req, res) => {
  await pool.query(
    `UPDATE ai_alerts SET resolved = TRUE, resolved_at = NOW() WHERE id = $1`,
    [req.params.id]
  );
  res.json({ ok: true });
});

// ── GET /api/ai/history ───────────────────────────────────────
router.get('/history', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 30);
    const { rows } = await pool.query(`
      SELECT date, hour, route,
             trips_count, passengers_count,
             ROUND(avg_duration_min::numeric, 1) AS avg_duration_min,
             ROUND(total_revenue::numeric, 2)    AS total_revenue
        FROM ai_history
       WHERE date >= CURRENT_DATE - ($1 || ' days')::interval
       ORDER BY date DESC, hour ASC, route ASC
    `, [days]);

    // Agrupar por fecha para facilitar el frontend
    const byDate = {};
    rows.forEach(r => {
      if (!byDate[r.date]) byDate[r.date] = [];
      byDate[r.date].push(r);
    });

    // Patrones detectados: horas pico
    const hourCounts = {};
    rows.forEach(r => {
      if (!hourCounts[r.hour]) hourCounts[r.hour] = 0;
      hourCounts[r.hour] += r.passengers_count;
    });
    const peakHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour, pax]) => ({ hour: parseInt(hour), avgPassengers: Math.round(pax / days) }));

    res.json({ ok: true, history: byDate, peakHours, totalDays: days });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

// ── GET /api/ai/decisions ─────────────────────────────────────
router.get('/decisions', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, decision_type, route, action_taken, reason, ai_explanation, created_at
        FROM ai_decisions
       ORDER BY created_at DESC
       LIMIT 20
    `);
    res.json({ ok: true, decisions: rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener decisiones' });
  }
});

// ── POST /api/ai/run ──────────────────────────────────────────
// Disparar análisis manual desde el admin
router.post('/run', async (req, res) => {
  try {
    res.json({ ok: true, message: 'Análisis iniciado — los resultados estarán disponibles en segundos' });
    setImmediate(runAnalysis);
  } catch (err) {
    res.status(500).json({ error: 'Error al iniciar análisis' });
  }
});

// ── GET /api/ai/driver-brief ──────────────────────────────────
// Resumen personalizado para el conductor autenticado:
// saludo de Claude (o fallback), posición en cola, ETA y probabilidad
router.get('/driver-brief', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const now   = new Date();
    const hour  = now.getHours();

    // Resolver driver desde el usuario JWT (users.id → drivers.id)
    const drRes = await pool.query(
      `SELECT d.id, d.first_name FROM drivers d
        WHERE d.user_id = $1 AND d.active = TRUE LIMIT 1`,
      [req.user.id]
    );
    const driver     = drRes.rows[0];
    const driver_id  = driver?.id || null;
    const driverName = driver?.first_name || req.user.username || 'Conductor';

    // Cola activa del conductor hoy (excluye salidos y cancelados)
    let queueData = null;
    if (driver_id) {
      const [entryRes, avgRes] = await Promise.all([
        pool.query(`
          SELECT route, position, turn_number
            FROM queue_entries
           WHERE driver_id = $1 AND queue_date = $2
             AND active = TRUE
             AND position NOT IN ('departed', 'cancelled')
           ORDER BY registered_at DESC LIMIT 1
        `, [driver_id, today]),

        pool.query(`
          SELECT r.slug AS route,
                 AVG(EXTRACT(EPOCH FROM (t.end_time - t.start_time)) / 60) AS avg_min
            FROM trips t JOIN routes r ON r.id = t.route_id
           WHERE t.status = 'completed' AND t.end_time IS NOT NULL
             AND t.start_time >= NOW() - INTERVAL '30 days'
           GROUP BY r.slug
        `),
      ]);

      if (entryRes.rows.length > 0) {
        const entry  = entryRes.rows[0];
        const myTurn = entry.turn_number;
        const route  = entry.route;

        const avgMap = {};
        avgRes.rows.forEach(r => { avgMap[r.route] = parseFloat(r.avg_min) || 45; });
        const avgMin = Math.round(avgMap[route] || 45);

        // Cuántas unidades van antes (sin departed/cancelled)
        const aheadRes = await pool.query(`
          SELECT COUNT(*) AS cnt
            FROM queue_entries
           WHERE queue_date = $1 AND route = $2 AND active = TRUE
             AND turn_number < $3 AND position NOT IN ('departed', 'cancelled')
        `, [today, route, myTurn]);

        const ahead            = parseInt(aheadRes.rows[0].cnt) || 0;
        const estimatedMinutes = ahead * avgMin;

        // Probabilidad estimada de salir pronto
        let probability;
        if (entry.position === 'calling') probability = 0.99;
        else if (ahead === 0)             probability = 0.96;
        else if (ahead <= 1)             probability = 0.87;
        else if (ahead <= 3)             probability = 0.73;
        else if (ahead <= 5)             probability = 0.58;
        else                             probability = 0.40;

        queueData = {
          position:         myTurn,
          ahead,
          route,
          routeLabel:       route === 'juli-puno' ? 'Juli → Puno' : 'Puno → Juli',
          estimatedMinutes,
          probability,
          currentPosition:  entry.position,
        };
      }
    }

    // Saludo personalizado con Claude (fallback determinístico si no hay API key)
    const greetWord = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
    let greeting    = null;

    if (process.env.ANTHROPIC_API_KEY) {
      const qCtx = queueData
        ? `Cola: posición #${queueData.position} en ${queueData.routeLabel}. ` +
          `${queueData.ahead} unidad(es) antes. Tiempo estimado: ${queueData.estimatedMinutes} min. ` +
          (queueData.currentPosition === 'calling' ? 'ESTADO: LLAMANDO — es su turno.' : '')
        : 'No inscrito en cola hoy.';

      greeting = await callClaude(
        `Eres CHASKI AI, copiloto inteligente de conductores de ATIPCAR en la ruta Juli-Puno, Perú. ` +
        `Genera un saludo operativo y cálido en español (máximo 2 oraciones, 130 caracteres). ` +
        `Sin markdown ni asteriscos.`,
        `${greetWord} ${driverName}. Hora: ${hour}:00. ${qCtx}`
      );
    }

    greeting = greeting || (queueData
      ? `${greetWord}, ${driverName}. Turno #${queueData.position} en ${queueData.routeLabel} — ` +
        (queueData.currentPosition === 'calling'
          ? '¡ES TU TURNO! Dirígete al terminal.'
          : queueData.ahead === 0
            ? '¡Estás el siguiente! Prepárate.'
            : `${queueData.ahead} unidad(es) antes, ~${queueData.estimatedMinutes} min de espera.`)
      : `${greetWord}, ${driverName}. No estás inscrito en la cola hoy. ¡Que sea un buen día!`);

    res.json({ ok: true, greeting, driverName, queue: queueData });
  } catch (err) {
    console.error('[AI driver-brief]', err.message);
    res.status(500).json({ error: 'Error al generar resumen del conductor' });
  }
});

module.exports = router;
