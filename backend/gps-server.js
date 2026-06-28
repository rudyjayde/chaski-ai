// ============================================================
// CHASKI AI 2.0 — Servidor TCP para Teltonika FMC130 (Codec 8)
// Puerto por defecto: 2223
// ============================================================
const net  = require('net');
const pool = require('./config/db');

const GPS_PORT = parseInt(process.env.GPS_TCP_PORT || '2223');

// ── Decodificador Codec 8 ────────────────────────────────────

function decodeCodec8(buf, offset) {
  const records = [];
  const codecId = buf.readUInt8(offset);      // debe ser 0x08
  if (codecId !== 0x08) return records;
  offset++;

  const count = buf.readUInt8(offset++);

  for (let i = 0; i < count; i++) {
    if (offset + 24 > buf.length) break;

    const tsMs = buf.readBigUInt64BE(offset);  offset += 8;
    const pri  = buf.readUInt8(offset);        offset += 1;

    // GPS element (15 bytes)
    const lonRaw = buf.readInt32BE(offset);    offset += 4;
    const latRaw = buf.readInt32BE(offset);    offset += 4;
    const alt    = buf.readInt16BE(offset);    offset += 2;
    const angle  = buf.readUInt16BE(offset);   offset += 2;
    const sats   = buf.readUInt8(offset);      offset += 1;
    const speed  = buf.readUInt16BE(offset);   offset += 2;

    const lon = lonRaw / 1e7;
    const lat = latRaw / 1e7;

    // IO element — leer para avanzar el puntero
    const ioEventId   = buf.readUInt8(offset);  offset += 1;
    const ioTotalCount = buf.readUInt8(offset);  offset += 1;

    // 1-byte IOs
    const n1 = buf.readUInt8(offset); offset += 1;
    offset += n1 * 3;
    // 2-byte IOs
    const n2 = buf.readUInt8(offset); offset += 1;
    offset += n2 * 5;
    // 4-byte IOs
    const n4 = buf.readUInt8(offset); offset += 1;
    offset += n4 * 9;
    // 8-byte IOs
    const n8 = buf.readUInt8(offset); offset += 1;
    offset += n8 * 17;

    if (lat !== 0 && lon !== 0) {
      records.push({
        timestamp: new Date(Number(tsMs)),
        lat, lon, alt, heading: angle, satellites: sats, speed,
      });
    }
  }

  return records;
}

// ── Guardar posiciones en BD ─────────────────────────────────

async function savePositions(deviceId, records) {
  if (!records.length) return;

  // Buscar vehicle_id por gps_device_id
  const vRes = await pool.query(
    'SELECT id FROM vehicles WHERE gps_device_id = $1 LIMIT 1',
    [deviceId]
  );
  if (!vRes.rows.length) {
    console.log(`[GPS] Dispositivo ${deviceId} no tiene vehículo asignado`);
    return;
  }
  const vehicleId = vRes.rows[0].id;

  for (const r of records) {
    await pool.query(
      `INSERT INTO gps_positions
         (vehicle_id, latitude, longitude, altitude, speed, heading, satellites, recorded_at, device_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [vehicleId, r.lat, r.lon, r.alt, r.speed, r.heading, r.satellites, r.timestamp, deviceId]
    );
  }
  console.log(`[GPS] ${records.length} posición(es) guardadas — vehículo ${vehicleId}`);
}

// ── Servidor TCP ─────────────────────────────────────────────

const server = net.createServer((socket) => {
  let deviceId  = null;
  let imeiDone  = false;
  let buffer    = Buffer.alloc(0);

  const addr = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[GPS] Conexión nueva: ${addr}`);

  socket.on('data', async (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    // Paso 1: leer IMEI (primer mensaje: 2 bytes de longitud + IMEI ASCII)
    if (!imeiDone) {
      if (buffer.length < 2) return;
      const imeiLen = buffer.readUInt16BE(0);
      if (buffer.length < 2 + imeiLen) return;

      deviceId  = buffer.slice(2, 2 + imeiLen).toString('ascii');
      imeiDone  = true;
      buffer    = buffer.slice(2 + imeiLen);

      console.log(`[GPS] IMEI recibido: ${deviceId}`);
      socket.write(Buffer.from([0x01])); // aceptar
      return;
    }

    // Paso 2: paquete de datos Codec 8
    if (buffer.length < 12) return;

    const preamble  = buffer.readUInt32BE(0); // debe ser 0x00000000
    if (preamble !== 0) { buffer = Buffer.alloc(0); return; }

    const dataLen   = buffer.readUInt32BE(4);
    const totalLen  = 4 + 4 + dataLen + 4; // preamble + len + data + crc
    if (buffer.length < totalLen) return;

    const codecOffset = 8; // después de preamble y dataLen
    const records = decodeCodec8(buffer, codecOffset);
    const count   = records.length;

    // Responder con cantidad de registros aceptados
    const ack = Buffer.alloc(4);
    ack.writeUInt32BE(count, 0);
    socket.write(ack);

    buffer = buffer.slice(totalLen);

    if (count > 0) {
      try { await savePositions(deviceId, records); }
      catch (err) { console.error('[GPS] Error guardando:', err.message); }
    }
  });

  socket.on('close', () => console.log(`[GPS] Desconectado: ${addr} (${deviceId || 'sin IMEI'})`));
  socket.on('error', (err) => console.error(`[GPS] Error socket ${addr}:`, err.message));
});

function startGPSServer() {
  server.listen(GPS_PORT, '0.0.0.0', () => {
    console.log(`   GPS TCP  : Puerto ${GPS_PORT} (Teltonika FMC130 Codec 8)`);
  });
  server.on('error', (err) => {
    console.error(`[GPS] Error iniciando servidor TCP:`, err.message);
  });
}

module.exports = { startGPSServer };
