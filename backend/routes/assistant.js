// ============================================================
// CHASKI AI 2.0 — Asistente IA Operativo
// POST /api/assistant/chat
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { aiLimiter } = require('../middleware/rateLimiter');

// ── Normalizar texto para detección de intenciones ───────────
// Quita acentos y convierte a minúsculas para matching robusto
function norm(text) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim();
}

// ── Consultar base de datos según la intención ───────────────
async function queryDatabase(message) {
  const msg = norm(message);
  const db  = pool;

  // ── PERÍODO ───────────────────────────────────────────────
  let periodo = 'today';
  if (/semana|semanal/.test(msg))   periodo = 'week';
  else if (/mes|mensual/.test(msg)) periodo = 'month';
  else if (/ayer/.test(msg))        periodo = 'yesterday';

  const dateFilterTrips = {
    today:     "DATE(t.start_time) = CURRENT_DATE",
    yesterday: "DATE(t.start_time) = CURRENT_DATE - INTERVAL '1 day'",
    week:      "t.start_time >= CURRENT_DATE - INTERVAL '7 days'",
    month:     "DATE_TRUNC('month', t.start_time) = DATE_TRUNC('month', CURRENT_DATE)",
  }[periodo];

  const dateFilterManifests = dateFilterTrips.replace(/t\.start_time/g, 'm.created_at');

  try {

    // ──────────────────────────────────────────────────────────
    // INTENCIÓN: RESUMEN DEL DÍA
    // ──────────────────────────────────────────────────────────
    if (/resumen|informe|como va|que paso|balance|hoy en total|del dia/.test(msg)) {
      const [cola, viajes, manifAbiertos] = await Promise.all([
        db.query(`
          SELECT COUNT(*) FILTER (WHERE position = 'calling')  AS llamando,
                 COUNT(*) FILTER (WHERE position = 'departed') AS salidos,
                 COUNT(*) FILTER (WHERE position NOT IN ('departed','cancelled')) AS en_cola
          FROM queue_entries
          WHERE queue_date = CURRENT_DATE AND active = TRUE
        `),
        db.query(`
          SELECT COUNT(*)                         AS total_viajes,
                 COALESCE(SUM(revenue), 0)        AS total_revenue,
                 COALESCE(SUM(m.total_passengers),0) AS total_pasajeros
          FROM trips t
          LEFT JOIN manifests m ON m.id = t.manifest_id
          WHERE DATE(t.start_time) = CURRENT_DATE
        `),
        db.query(`
          SELECT COUNT(*) AS pendientes
          FROM manifests WHERE status = 'open'
        `),
      ]);

      return {
        tipo: 'resumen',
        periodo,
        cola:           cola.rows[0],
        viajes:         viajes.rows[0],
        manifAbiertos:  manifAbiertos.rows[0].pendientes,
      };
    }

    // ──────────────────────────────────────────────────────────
    // INTENCIÓN: INGRESOS POR EMPRESA
    // ──────────────────────────────────────────────────────────
    if (/empresa|compan|sociedad/.test(msg) &&
        /ingreso|recaud|gano|revenue|mas|mejor|genero|top/.test(msg)) {
      const r = await db.query(`
        SELECT
          COALESCE(c.name, 'Sin empresa') AS company,
          COUNT(DISTINCT d.id)            AS total_drivers,
          COUNT(DISTINCT t.id)            AS total_viajes,
          COALESCE(SUM(m.total_revenue),    0) AS total_revenue,
          COALESCE(SUM(m.total_passengers), 0) AS total_pasajeros
        FROM companies c
        LEFT JOIN vehicles v  ON v.company_id  = c.id  AND v.active = TRUE
        LEFT JOIN drivers d   ON d.vehicle_id  = v.id  AND d.active = TRUE
        LEFT JOIN trips t     ON t.driver_id   = d.id  AND ${dateFilterTrips}
        LEFT JOIN manifests m ON m.driver_id   = d.id  AND ${dateFilterManifests}
        WHERE c.active = TRUE
        GROUP BY c.id, c.name
        ORDER BY total_revenue DESC
      `);
      return { tipo: 'empresas', periodo, empresas: r.rows };
    }

    // ──────────────────────────────────────────────────────────
    // INTENCIÓN: MANIFIESTOS SIN CERRAR
    // ──────────────────────────────────────────────────────────
    if (/manif/.test(msg) &&
        /abierto|sin cerrar|pendiente|falta|no cerr|cerrar/.test(msg)) {
      const r = await db.query(`
        SELECT m.manifest_number, m.departure_time, m.created_at,
               m.total_passengers, m.total_revenue,
               d.first_name || ' ' || d.last_name AS driver_name,
               v.association_code, v.plate
        FROM manifests m
        JOIN drivers d  ON d.id = m.driver_id
        LEFT JOIN vehicles v ON v.id = m.vehicle_id
        WHERE m.status = 'open'
        ORDER BY m.departure_time ASC NULLS LAST
      `);
      return { tipo: 'manifiestos_abiertos', manifiestos: r.rows };
    }

    // ──────────────────────────────────────────────────────────
    // INTENCIÓN: RETRASOS / DEMORAS
    // ──────────────────────────────────────────────────────────
    if (/retraso|tarde|demor|lento|tardanza|mas tiempo/.test(msg)) {
      const r = await db.query(`
        SELECT
          d.first_name || ' ' || d.last_name AS driver_name,
          v.association_code, v.plate,
          qe.registered_at,
          qe.departure_at,
          ROUND(EXTRACT(EPOCH FROM (qe.departure_at - qe.registered_at)) / 60) AS minutos_espera
        FROM queue_entries qe
        JOIN drivers d  ON d.id = qe.driver_id
        LEFT JOIN vehicles v ON v.id = qe.vehicle_id
        WHERE qe.queue_date = CURRENT_DATE
          AND qe.departure_at IS NOT NULL
          AND qe.active = TRUE
        ORDER BY minutos_espera DESC
        LIMIT 10
      `);
      return { tipo: 'retrasos', conductores: r.rows };
    }

    // ──────────────────────────────────────────────────────────
    // DETECCIÓN DE VEHÍCULO ESPECÍFICO
    // ──────────────────────────────────────────────────────────
    const placaMatch  = msg.match(/pun[-\s]?(\d{3})/i);
    const codigoMatch = msg.match(/(?:vehiculo|unidad|auto|bus|carro)?\s*#?(\d{1,3})\b/i);
    const stopwords   = ['el','la','los','las','del','de','hoy','esta','este',
      'semana','mes','viajes','vuelta','vueltas','cuantos','cuantas','dame',
      'muestra','info','informacion','reporte','vehiculo','unidad','conductor',
      'placa','estado','pun','alertas','alerta'];
    const palabras    = norm(message).split(/\s+/).filter(p =>
      p.length > 2 && !stopwords.includes(p) && !/^\d+$/.test(p)
    );

    let vehicle = null;

    if (placaMatch) {
      const placa = `PUN-${placaMatch[1].padStart(3, '0')}`;
      const r = await db.query(
        `SELECT v.id, v.association_code, v.plate, v.status, v.gps_device_id,
                COALESCE(d.first_name || ' ' || d.last_name, 'Sin asignar') AS driver_name,
                d.phone AS driver_phone, COALESCE(c.name, 'Sin empresa') AS company
         FROM vehicles v
         LEFT JOIN drivers   d ON d.vehicle_id = v.id AND d.active = TRUE
         LEFT JOIN companies c ON c.id = v.company_id
         WHERE UPPER(v.plate) = UPPER($1) AND v.active = TRUE`,
        [placa]
      );
      if (r.rows.length) vehicle = r.rows[0];
    }

    if (!vehicle && codigoMatch) {
      const codigo = codigoMatch[1].padStart(3, '0');
      const r = await db.query(
        `SELECT v.id, v.association_code, v.plate, v.status, v.gps_device_id,
                COALESCE(d.first_name || ' ' || d.last_name, 'Sin asignar') AS driver_name,
                d.phone AS driver_phone, COALESCE(c.name, 'Sin empresa') AS company
         FROM vehicles v
         LEFT JOIN drivers   d ON d.vehicle_id = v.id AND d.active = TRUE
         LEFT JOIN companies c ON c.id = v.company_id
         WHERE v.association_code = $1 AND v.active = TRUE`,
        [codigo]
      );
      if (r.rows.length) vehicle = r.rows[0];
    }

    if (!vehicle && palabras.length > 0) {
      for (const palabra of palabras) {
        const r = await db.query(
          `SELECT v.id, v.association_code, v.plate, v.status, v.gps_device_id,
                  COALESCE(d.first_name || ' ' || d.last_name, 'Sin asignar') AS driver_name,
                  d.phone AS driver_phone, COALESCE(c.name, 'Sin empresa') AS company
           FROM vehicles v
           JOIN drivers   d ON d.vehicle_id = v.id AND d.active = TRUE
           LEFT JOIN companies c ON c.id = v.company_id
           WHERE (LOWER(d.first_name) ILIKE $1 OR LOWER(d.last_name) ILIKE $1) AND v.active = TRUE
           LIMIT 1`,
          [`%${palabra}%`]
        );
        if (r.rows.length) { vehicle = r.rows[0]; break; }
      }
    }

    if (vehicle) {
      const trips = await db.query(
        `SELECT t.id, t.start_time, t.end_time, t.status, t.revenue, t.max_speed, t.avg_speed,
                m.manifest_number, m.total_passengers, m.total_revenue, m.total_cash, m.total_digital
         FROM trips t
         LEFT JOIN manifests m ON m.id = t.manifest_id
         WHERE t.vehicle_id = $1 AND ${dateFilterTrips}
         ORDER BY t.start_time ASC`,
        [vehicle.id]
      );

      let alertas = { rows: [] };
      try {
        alertas = await db.query(
          `SELECT sa.max_speed, sa.severity, sa.occurred_at
           FROM speed_alerts sa
           WHERE sa.vehicle_id = $1 AND DATE(sa.occurred_at) = CURRENT_DATE
           ORDER BY sa.occurred_at DESC LIMIT 5`,
          [vehicle.id]
        );
      } catch (_) { /* speed_alerts table may not exist yet */ }

      const totalViajes      = trips.rows.length;
      const totalPasajeros   = trips.rows.reduce((s, t) => s + (parseInt(t.total_passengers) || 0), 0);
      const totalRecaudacion = trips.rows.reduce((s, t) => s + (parseFloat(t.total_revenue)   || 0), 0);

      return {
        tipo: 'vehiculo', periodo, vehicle,
        trips: trips.rows, alertas: alertas.rows,
        resumen: { totalViajes, totalPasajeros, totalRecaudacion },
      };
    }

    // ──────────────────────────────────────────────────────────
    // INTENCIÓN: FLOTA GENERAL
    // ──────────────────────────────────────────────────────────
    if (/flota|estado general|cuantos vehiculos|cuantas unidades|total de vehiculos/.test(msg)) {
      const [estados, gps] = await Promise.all([
        db.query(`SELECT status, COUNT(*) AS total FROM vehicles WHERE active = TRUE GROUP BY status`),
        db.query(`SELECT COUNT(*) FILTER (WHERE gps_device_id IS NOT NULL) AS con_gps,
                         COUNT(*) FILTER (WHERE gps_device_id IS NULL)     AS sin_gps
                  FROM vehicles WHERE active = TRUE`),
      ]);
      return { tipo: 'flota', estados: estados.rows, gps: gps.rows[0] };
    }

    // ──────────────────────────────────────────────────────────
    // INTENCIÓN: RANKING / TOP CONDUCTORES
    // ──────────────────────────────────────────────────────────
    if (/top|mejor|mas viajes|recaud|recaudo|ranking|quien.*mas|cuanto.*gano|lider/.test(msg)) {
      const r = await db.query(`
        SELECT
          d.first_name || ' ' || d.last_name   AS driver_name,
          COALESCE(c.name, 'Sin empresa')       AS company,
          COUNT(DISTINCT t.id)                  AS total_viajes,
          COALESCE(SUM(m.total_revenue),    0)  AS total_revenue,
          COALESCE(SUM(m.total_passengers), 0)  AS total_pasajeros
        FROM drivers d
        LEFT JOIN vehicles  v ON v.id  = d.vehicle_id
        LEFT JOIN companies c ON c.id  = v.company_id
        LEFT JOIN trips     t ON t.driver_id = d.id AND ${dateFilterTrips}
        LEFT JOIN manifests m ON m.driver_id = d.id AND ${dateFilterManifests}
        WHERE d.active = TRUE
        GROUP BY d.id, d.first_name, d.last_name, c.name
        ORDER BY total_revenue DESC
        LIMIT 5
      `);
      return { tipo: 'ranking', periodo, conductores: r.rows };
    }

    // ──────────────────────────────────────────────────────────
    // INTENCIÓN: ALERTAS DE VELOCIDAD
    // ──────────────────────────────────────────────────────────
    if (/alerta|velocidad|exceso|excedieron|peligro|infraccion|rapido/.test(msg)) {
      let alertas = [];
      try {
        const r = await db.query(`
          SELECT sa.max_speed, sa.severity, sa.occurred_at,
                 v.association_code, v.plate,
                 d.first_name || ' ' || d.last_name AS driver_name
          FROM speed_alerts sa
          JOIN vehicles v ON v.id = sa.vehicle_id
          JOIN drivers  d ON d.id = sa.driver_id
          WHERE DATE(sa.occurred_at) = CURRENT_DATE
          ORDER BY sa.occurred_at DESC LIMIT 10
        `);
        alertas = r.rows;
      } catch (_) { /* speed_alerts table may not exist yet */ }
      return { tipo: 'alertas', alertas };
    }

    // ──────────────────────────────────────────────────────────
    // INTENCIÓN: COLA DE SALIDA (tabla corregida)
    // ──────────────────────────────────────────────────────────
    if (/cola|turno|lista diaria|quien sale|quienes salen/.test(msg)) {
      const r = await db.query(`
        SELECT qe.turn_number AS posicion,
               qe.position    AS estado,
               qe.registered_at,
               qe.departure_at,
               v.association_code, v.plate,
               d.first_name || ' ' || d.last_name AS driver_name,
               COALESCE(c.name, 'Sin empresa') AS company
        FROM queue_entries qe
        JOIN drivers   d ON d.id = qe.driver_id
        LEFT JOIN vehicles  v ON v.id = qe.vehicle_id
        LEFT JOIN companies c ON c.id = v.company_id
        WHERE qe.queue_date = CURRENT_DATE AND qe.active = TRUE
        ORDER BY qe.turn_number ASC
      `);
      return { tipo: 'cola', turnos: r.rows };
    }

    return { tipo: 'general', mensaje: message };

  } catch (err) {
    console.error('[assistant] Error BD:', err.message);
    return { tipo: 'error', error: err.message };
  }
}

// ── Mapear resultado de BD al formato del frontend ───────────
function mapToFrontend(dbResult) {
  const { tipo } = dbResult;

  if (tipo === 'vehiculo') {
    const v = {
      ...dbResult.vehicle,
      trips_today:      dbResult.resumen.totalViajes,
      passengers_today: dbResult.resumen.totalPasajeros,
      revenue_today:    dbResult.resumen.totalRecaudacion,
    };
    const manifests = dbResult.trips.map(t => ({
      manifest_number:  t.manifest_number || `T-${t.id?.slice(0,8)}`,
      departure_time:   t.start_time,
      arrival_time:     t.end_time,
      total_passengers: t.total_passengers || 0,
      total_revenue:    t.total_revenue || t.revenue || 0,
      status:           t.status,
    }));
    return { intent: 'vehicle', data: { vehicle: v, manifests, alertas: dbResult.alertas, periodo: dbResult.periodo } };
  }

  if (tipo === 'flota') {
    return { intent: 'fleet', data: { por_estado: dbResult.estados, gps: dbResult.gps } };
  }

  if (tipo === 'ranking') {
    return { intent: 'revenue', data: { top_drivers: dbResult.conductores, periodo: dbResult.periodo } };
  }

  if (tipo === 'empresas') {
    return { intent: 'companies', data: { empresas: dbResult.empresas, periodo: dbResult.periodo } };
  }

  if (tipo === 'manifiestos_abiertos') {
    return { intent: 'open_manifests', data: { manifiestos: dbResult.manifiestos } };
  }

  if (tipo === 'retrasos') {
    return { intent: 'delays', data: { conductores: dbResult.conductores } };
  }

  if (tipo === 'resumen') {
    return { intent: 'summary', data: { cola: dbResult.cola, viajes: dbResult.viajes, manifAbiertos: dbResult.manifAbiertos, periodo: dbResult.periodo } };
  }

  if (tipo === 'alertas') {
    return { intent: 'alerts', data: { speed_alerts: dbResult.alertas, route_alerts: [] } };
  }

  if (tipo === 'cola') {
    return { intent: 'queue', data: { queue: dbResult.turnos } };
  }

  return { intent: 'general', data: null };
}

// ── System prompt ────────────────────────────────────────────
const SYSTEM_PROMPT = `Eres el asistente operativo de CHASKI AI para la Asociación ATIPCAR, ruta Juli–Puno, Perú.
Ayudas al administrador a consultar y analizar información operativa en tiempo real.

Tienes acceso a datos reales de: vehículos, conductores, manifiestos, viajes, cola de salida, empresas y alertas.

REGLAS:
- Responde siempre en español, directo y conciso.
- Cuando recibes datos del sistema entre [DATOS DEL SISTEMA], úsalos para dar números exactos.
- Usa S/. para valores monetarios en soles peruanos.
- Si hay datos de ranking, indica claramente quién va primero.
- Si detectas algo preocupante (manifiestos sin cerrar, velocidades altas, conductores con mucho retraso), mencionarlo y sugerir acción.
- Si el usuario pide un reporte o PDF, incluye al final: ACTION:EXPORT_PDF
- NUNCA inventes datos. Si no hay datos disponibles, dilo claramente.
- Sé analítico: no solo repites datos, también los interpretas.`;

// ── Endpoint principal ───────────────────────────────────────
router.post('/chat', aiLimiter, async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'El campo message es requerido.' });
  }

  // 1. Consultar BD
  const dbResult = await queryDatabase(message);
  console.log(`[assistant] "${message}" → tipo=${dbResult.tipo}`);

  // 2. Mapear al formato del frontend
  const { intent, data } = mapToFrontend(dbResult);

  // 3. Construir contexto para Claude
  let contextMessage = message;
  if (dbResult.tipo !== 'general' && dbResult.tipo !== 'error') {
    contextMessage = `${message}\n\n[DATOS DEL SISTEMA — ${new Date().toLocaleString('es-PE')}]:\n${JSON.stringify(dbResult, null, 2)}`;
  } else if (dbResult.tipo === 'error') {
    contextMessage = `${message}\n\n[ERROR BD: ${dbResult.error}]`;
  }

  // 4. Mensajes para Anthropic
  const messages = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: contextMessage },
  ];

  // 5. Llamar a Anthropic
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'ANTHROPIC_API_KEY no configurada en .env' });
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 1024,
        system:     SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      console.error('[assistant] Anthropic error:', anthropicRes.status, errBody);
      return res.status(502).json({ error: `Error API Anthropic: ${anthropicRes.status}` });
    }

    const anthropicData = await anthropicRes.json();
    const responseText  = anthropicData.content?.[0]?.text || 'Sin respuesta.';
    const wantsPDF      = responseText.includes('ACTION:EXPORT_PDF');
    const cleanResponse = responseText.replace('ACTION:EXPORT_PDF', '').trim();

    return res.json({
      response: cleanResponse,
      data,
      action:  wantsPDF ? 'export_pdf' : null,
      intent,
    });

  } catch (err) {
    console.error('[assistant] Error:', err.message);
    return res.status(500).json({ error: `Error interno: ${err.message}` });
  }
});

module.exports = router;
