function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Datos inválidos.', details: err.details?.map(d => d.message) });
  }

  if (err.code === '23505') {
    return res.status(409).json({ error: 'Registro duplicado.' });
  }
  if (err.code === '23503') {
    return res.status(409).json({ error: 'Referencia a registro inexistente.' });
  }
  if (err.code === '42P01') {
    return res.status(500).json({ error: 'Error de base de datos: tabla no encontrada.' });
  }

  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }

  res.status(500).json({ error: 'Error interno del servidor.' });
}

module.exports = errorHandler;
