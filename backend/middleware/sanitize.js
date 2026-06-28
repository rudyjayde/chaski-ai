const xss = require('xss');

function sanitizeValue(val) {
  if (typeof val === 'string') return xss(val.trim());
  if (Array.isArray(val))     return val.map(sanitizeValue);
  if (val && typeof val === 'object') return sanitizeObject(val);
  return val;
}

function sanitizeObject(obj) {
  const clean = {};
  for (const key of Object.keys(obj)) {
    clean[key] = sanitizeValue(obj[key]);
  }
  return clean;
}

function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

function sanitizeQuery(req, res, next) {
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  next();
}

module.exports = { sanitizeBody, sanitizeQuery };
