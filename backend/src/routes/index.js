const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const catalogRoutes = require('./catalog.routes');
const customersRoutes = require('./customers.routes');
const ordersRoutes = require('./orders.routes');
const reportsRoutes = require('./reports.routes');
const uploadsRoutes = require('./uploads.routes');
const webhooksRoutes = require('./webhooks.routes');
const designsRoutes = require('./designs.routes');

module.exports = {
  healthRoutes,
  authRoutes,
  catalogRoutes,
  customersRoutes,
  ordersRoutes,
  reportsRoutes,
  uploadsRoutes,
  webhooksRoutes,
  designsRoutes,
};
