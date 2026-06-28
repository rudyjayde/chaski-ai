// CSRF protection — stateless, JWT-embedded approach.
// The csrfToken is generated at login, embedded in the JWT payload,
// and must be sent by the client as the X-CSRF-Token header.
// This is defense-in-depth: JWT in Authorization header already prevents CSRF,
// but this adds a second layer for high-sensitivity endpoints.

const CSRF_HEADER  = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function csrfMiddleware(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  // req.user must be populated by auth middleware first
  const serverToken = req.user?.csrfToken;
  const clientToken = req.headers[CSRF_HEADER];

  if (!serverToken || !clientToken || serverToken !== clientToken) {
    return res.status(403).json({ error: 'Token CSRF inválido o ausente.' });
  }
  next();
}

module.exports = { csrfMiddleware };
