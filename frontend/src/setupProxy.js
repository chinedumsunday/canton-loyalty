const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use('/v2', createProxyMiddleware({
    target: 'http://localhost:7575',
    changeOrigin: true,
    headers: { origin: 'http://localhost:3000' }
  }));
};