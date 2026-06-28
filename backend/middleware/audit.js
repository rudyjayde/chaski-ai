const pool = require('../config/db');

async function log({ req, action, entityType = null, entityId = null, details = null, status = 'success' }) {
  try {
    const user      = req?.user || null;
    const ip        = req?.ip || req?.connection?.remoteAddress || null;
    const userAgent = req?.headers?.['user-agent'] || null;

    await pool.query(
      `INSERT INTO audit_logs
         (user_id, username, role, action, entity_type, entity_id, details, ip_address, user_agent, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        user?.id       || null,
        user?.username || null,
        user?.role     || null,
        action,
        entityType,
        entityId ? String(entityId) : null,
        details ? JSON.stringify(details) : null,
        ip,
        userAgent,
        status,
      ]
    );
  } catch (err) {
    console.error('[audit] Error writing audit log:', err.message);
  }
}

function auditMiddleware(action, getEntityId = null) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      const status = res.statusCode >= 400 ? 'failure' : 'success';
      const entityId = getEntityId ? getEntityId(req, body) : null;
      log({ req, action, entityId, status }).catch(() => {});
      return originalJson(body);
    };
    next();
  };
}

module.exports = { log, auditMiddleware };
