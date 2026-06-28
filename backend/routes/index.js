// Registra todas las rutas en la app Express
module.exports = function registerRoutes(app) {
  app.use('/api/auth',      require('./auth'));
  app.use('/api/drivers',   require('./drivers'));
  app.use('/api/vehicles',  require('./vehicles'));
  app.use('/api/queue',     require('./queue'));
  app.use('/api/manifests', require('./manifests'));
  app.use('/api/trips',     require('./trips'));
  app.use('/api/reports',   require('./reports'));
  app.use('/api/assistant', require('./assistant'));
};
