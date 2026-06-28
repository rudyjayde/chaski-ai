// ============================================================
// CHASKI AI 2.0 — Ruta del Asistente IA
// POST /api/assistant/chat
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { aiLimiter } = require('../middleware/rateLimiter');

// ── Detección de intención y consulta SQL ────────────────────

async function queryDatabase(message) {
  const msg = message.toLowerCase().trim();
  const db  = pool; // alias para claridad

  // ─── DETECCIÓN DE VEHÍCULO ───────────────────────────────

  // 1. Por placa (PUN-001, pun001, PUN 001)
  const placaMatch = msg.match(/pun[-\s]?(\d{3})/i);

  // 2. Por código numérico (001, 01, 1, vehículo 5, unidad 14)
  const codigoMatch = msg.match(
    /(?:veh[íi]culo|unidad|auto|bus|carro)?\s*#?(\d{1,3})\b/i
  );

  // 3. Por nombre de conductor — extraer palabras que no sean stopwords
  const stopwords = ['el','la','los','las','del','de','hoy','esta',
    'este','semana','mes','viajes','vuelta','vueltas','cuantos',
    'cuántos','dame','muestra','info','información','reporte',
    'vehículo','vehiculo','unidad','conductor','placa','estado',
    'pun','alertas','alerta'];
  const palabras = msg.split(/\s+/).filter(p =>
    p.length > 2 && !stopwords.includes(p) && !/^\d+$/.test(p)
  );

  // ─── PERÍODO ─────────────────────────────────────────────
  let periodo = 'today';
  if (msg.includes('semana'))      periodo = 'week';
  else if (msg.includes('mes'))    periodo = 'month';
  else if (msg.includes('ayer'))   periodo = 'yesterday';

  const filtroFecha = {
    today:     "DATE(t.start_time) = CURRENT_DATE",
    yesterday: "DATE(t.start_time) = CURRENT_DATE - INTERVAL '1 day'",
    week:      "t.start_time >= CURRENT_DATE - INTERVAL '7 days'",
    month:     "DATE_TRUNC('month', t.start_time) = DATE_TRUNC('month', CURRENT_DATE)",
  }[periodo];

  try {

    // ─── BUSCAR VEHÍCULO ─────────────────────────────────────
    let vehicle = null;

    // Intento 1: por placa
    if (placaMatch) {
      const placa = `PUN-${placaMatch[1].padStart(3, '0')}`;
      const r = await db.query(
        `SELECT v.id, v.association_code, v.plate, v.status,
                v.gps_device_id,
                COALESCE(d.first_name || ' ' || d.last_name, 'Sin asignar') AS driver_name,
                d.phone AS driver_phone,
                COALESCE(c.name, 'Sin empresa') AS company
         FROM vehicles v
         LEFT JOIN drivers   d ON d.vehicle_id = v.id
         LEFT JOIN companies c ON c.id = v.company_id
         WHERE UPPER(v.plate) = UPPER($1) AND v.active = true`,
        [placa]
      );
      if (r.rows.length) vehicle = r.rows[0];
    }

    // Intento 2: por código numérico
    if (!vehicle && codigoMatch) {
      const codigo = codigoMatch[1].padStart(3, '0');
      const r = await db.query(
        `SELECT v.id, v.association_code, v.plate, v.status,
                v.gps_device_id,
                COALESCE(d.first_name || ' ' || d.last_name, 'Sin asignar') AS driver_name,
                d.phone AS driver_phone,
                COALESCE(c.name, 'Sin empresa') AS company
         FROM vehicles v
         LEFT JOIN drivers   d ON d.vehicle_id = v.id
         LEFT JOIN companies c ON c.id = v.company_id
         WHERE v.association_code = $1 AND v.active = true`,
        [codigo]
      );
      if (r.rows.length) vehicle = r.rows[0];
    }

    // Intento 3: por nombre del conductor
    if (!vehicle && palabras.length > 0) {
      for (const palabra of palabras) {
        const r = await db.query(
          `SELECT v.id, v.association_code, v.plate, v.status,
                  v.gps_device_id,
                  COALESCE(d.first_name || ' ' || d.last_name, 'Sin asignar') AS driver_name,
                  d.phone AS driver_phone,
                  COALESCE(c.name, 'Sin empresa') AS company
           FROM vehicles v
           JOIN drivers   d ON d.vehicle_id = v.id
           LEFT JOIN companies c ON c.id = v.company_id
           WHERE (LOWER(d.first_name) ILIKE $1
              OR  LOWER(d.last_name)  ILIKE $1)
             AND v.active = true
           LIMIT 1`,
          [`%${palabra}%`]
        );
        if (r.rows.length) { vehicle = r.rows[0]; break; }
      }
    }

    // ─── SI ENCONTRÓ VEHÍCULO → TRAER SUS DATOS ──────────────
    if (vehicle) {
      const trips = await db.query(
        `SELECT t.id, t.start_time, t.end_time, t.status,
                t.revenue, t.max_speed, t.avg_speed,
                m.manifest_number, m.total_passengers,
                m.total_revenue, m.total_cash, m.total_digital
         FROM trips t
         LEFT JOIN manifests m ON m.id = t.manifest_id
         WHERE t.vehicle_id = $1 AND ${filtroFecha}
         ORDER BY t.start_time ASC`,
        [vehicle.id]
      );

      const alertas = await db.query(
        `SELECT sa.max_speed, sa.severity, sa.occurred_at
         FROM speed_alerts sa
         WHERE sa.vehicle_id = $1
           AND DATE(sa.occurred_at) = CURRENT_DATE
         ORDER BY sa.occurred_at DESC LIMIT 5`,
        [vehicle.id]
      );

      const totalViajes      = trips.rows.length;
      const totalPasajeros   = trips.rows.reduce((s, t) => s + (parseInt(t.total_passengers) || 0), 0);
      const totalRecaudacion = trips.rows.reduce((s, t) => s + (parseFloat(t.total_revenue)   || 0), 0);

      return {
        tipo: 'vehiculo',
        periodo,
        vehicle,
        trips:   trips.rows,
        alertas: alertas.rows,
        resumen: { totalViajes, totalPasajeros, totalRecaudacion },
      };
    }

    // ─── OTRAS INTENCIONES ────────────────────────────────────

    // Flota general
    if (msg.includes('flota') || msg.includes('estado general') ||
        msg.includes('cuantos vehiculos') || msg.includes('cuántos vehículos')) {
      const r = await db.query(
        `SELECT status, COUNT(*) AS total
         FROM vehicles WHERE active = true GROUP BY status`
      );
      const gps = await db.query(
        `SELECT COUNT(*) FILTER (WHERE gps_device_id IS NOT NULL) AS con_gps,
                COUNT(*) FILTER (WHERE gps_device_id IS NULL)     AS sin_gps
         FROM vehicles WHERE active = true`
      );
      return { tipo: 'flota', estados: r.rows, gps: gps.rows[0] };
    }

    // Top conductores / recaudación
    if (msg.includes('top') || msg.includes('mejor') ||
        msg.includes('más viajes') || msg.includes('recaudación') ||
        msg.includes('recaudo') || msg.includes('ranking')) {
      const r = await db.query(
        `SELECT d.first_name || ' ' || d.last_name AS driver_name,
                COALESCE(c.name, 'Sin empresa') AS company,
                COUNT(DISTINCT t.id)            AS total_trips,
                COALESCE(SUM(m.total_revenue),    0) AS total_revenue,
                COALESCE(SUM(m.total_passengers), 0) AS total_passengers
         FROM drivers d
         JOIN companies c ON c.id = d.company_id
         LEFT JOIN trips t ON t.driver_id = d.id
           AND DATE_TRUNC('month', t.start_time) = DATE_TRUNC('month', CURRENT_DATE)
         LEFT JOIN manifests m ON m.driver_id = d.id
           AND DATE_TRUNC('month', m.created_at) = DATE_TRUNC('month', CURRENT_DATE)
         GROUP BY d.id, c.name
         ORDER BY total_revenue DESC LIMIT 5`
      );
      return { tipo: 'ranking', conductores: r.rows };
    }

    // Alertas generales
    if (msg.includes('alerta') || msg.includes('velocidad') ||
        msg.includes('exceso') || msg.includes('peligro')) {
      const r = await db.query(
        `SELECT sa.max_speed, sa.severity, sa.occurred_at,
                v.association_code, v.plate,
                d.first_name || ' ' || d.last_name AS driver_name
         FROM speed_alerts sa
         JOIN vehicles v ON v.id = sa.vehicle_id
         JOIN drivers  d ON d.id = sa.driver_id
         WHERE DATE(sa.occurred_at) = CURRENT_DATE
         ORDER BY sa.occurred_at DESC LIMIT 10`
      );
      return { tipo: 'alertas', alertas: r.rows };
    }

    // Cola de salida
    if (msg.includes('cola') || msg.includes('turno') ||
        msg.includes('lista diaria') || msg.includes('salida')) {
      const r = await db.query(
        `SELECT eq.position, eq.status, eq.registered_at,
                eq.departure_time,
                v.association_code, v.plate,
                d.first_name || ' ' || d.last_name AS driver_name,
                c.name AS company
         FROM exit_queue eq
         JOIN vehicles  v ON v.id = eq.vehicle_id
         JOIN drivers   d ON d.id = eq.driver_id
         JOIN companies c ON c.id = d.company_id
         WHERE eq.queue_date = CURRENT_DATE
         ORDER BY eq.position ASC`
      );
      return { tipo: 'cola', turnos: r.rows };
    }

    // Sin intención clara
    return { tipo: 'general', mensaje: message };

  } catch (err) {
    console.error('Error consultando BD:', err.message);
    return { tipo: 'error', error: err.message };
  }
}

// ── Mapear resultado de BD al formato que espera el frontend ─

function mapToFrontend(dbResult) {
  const { tipo } = dbResult;

  if (tipo === 'vehiculo') {
    const v = dbResult.vehicle;
    // Enriquecer el objeto vehicle con los totales del resumen
    const vehicleData = {
      ...v,
      trips_today:      dbResult.resumen.totalViajes,
      passengers_today: dbResult.resumen.totalPasajeros,
      revenue_today:    dbResult.resumen.totalRecaudacion,
    };
    // Mapear trips a formato manifiesto para la tabla del widget
    const manifests = dbResult.trips.map(t => ({
      manifest_number:  t.manifest_number || `T-${t.id?.slice(0,8) || '?'}`,
      departure_time:   t.start_time,
      arrival_time:     t.end_time,
      total_passengers: t.total_passengers || 0,
      total_revenue:    t.total_revenue    || t.revenue || 0,
      status:           t.status,
    }));
    return {
      intent: 'vehicle',
      data:   { vehicle: vehicleData, manifests, alertas: dbResult.alertas, periodo: dbResult.periodo },
    };
  }

  if (tipo === 'flota') {
    return {
      intent: 'fleet',
      data:   { por_estado: dbResult.estados, gps: dbResult.gps },
    };
  }

  if (tipo === 'ranking') {
    return {
      intent: 'revenue',
      data:   { top_drivers: dbResult.conductores, periodo: 'este mes' },
    };
  }

  if (tipo === 'alertas') {
    return {
      intent: 'alerts',
      data:   { speed_alerts: dbResult.alertas, route_alerts: [] },
    };
  }

  if (tipo === 'cola') {
    return {
      intent: 'queue',
      data:   { queue: dbResult.turnos },
    };
  }

  return { intent: 'general', data: null };
}

// ── Sistema prompt del asistente ────────────────────────────

const SYSTEM_PROMPT = `Eres el asistente operativo de CHASKI AI, sistema de gestión de la Asociación de Transportistas Virgen de Fátima en la ruta Juli–Puno, Puno, Perú.
Tu rol es ayudar al administrador a consultar información del sistema de forma rápida y clara.
Tienes acceso a datos en tiempo real de vehículos, conductores, manifiestos, viajes, alertas y cola de salida.
Responde siempre en español. Sé directo y conciso.
Cuando tengas datos de la base de datos, preséntarlos de forma clara con los números exactos.
Usa moneda soles peruanos (S/.) para valores monetarios.
Si el usuario pide exportar o descargar un PDF o reporte, incluye al final de tu respuesta la frase exacta: ACTION:EXPORT_PDF
Nunca inventes datos. Si no hay datos disponibles o la base de datos no está conectada, dilo claramente y sugiere verificar la conexión.`;

// ── Endpoint principal ───────────────────────────────────────

router.post('/chat', aiLimiter, async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'El campo message es requerido.' });
  }

  // 1. Consultar BD con la nueva lógica de detección
  const dbResult = await queryDatabase(message);
  console.log(`[assistant] mensaje="${message}" → tipo=${dbResult.tipo}`);

  // 2. Mapear al formato que espera el frontend
  const { intent, data } = mapToFrontend(dbResult);

  // 3. Construir contexto para la IA
  let contextMessage = message;
  if (dbResult.tipo !== 'general' && dbResult.tipo !== 'error') {
    contextMessage = `${message}\n\n[DATOS DEL SISTEMA - ${new Date().toLocaleString('es-PE')}]:\n${JSON.stringify(dbResult, null, 2)}`;
  } else if (dbResult.tipo === 'error') {
    contextMessage = `${message}\n\n[NOTA: Error al consultar la base de datos: ${dbResult.error}]`;
  }

  // 4. Preparar mensajes para Anthropic
  const messages = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: contextMessage },
  ];

  // 5. Llamar a la API de Anthropic
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({
        error: 'ANTHROPIC_API_KEY no configurada en el archivo .env del backend.',
      });
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
      console.error('Error Anthropic API:', anthropicRes.status, errBody);
      return res.status(502).json({ error: `Error en la API de Anthropic: ${anthropicRes.status}` });
    }

    const anthropicData  = await anthropicRes.json();
    const responseText   = anthropicData.content?.[0]?.text || 'Sin respuesta.';
    const wantsPDF       = responseText.includes('ACTION:EXPORT_PDF');
    const cleanResponse  = responseText.replace('ACTION:EXPORT_PDF', '').trim();

    return res.json({
      response: cleanResponse,
      data,
      action:  wantsPDF ? 'export_pdf' : null,
      intent,
    });

  } catch (err) {
    console.error('Error llamando a Anthropic:', err.message);
    return res.status(500).json({ error: `Error interno: ${err.message}` });
  }
});

module.exports = router;
