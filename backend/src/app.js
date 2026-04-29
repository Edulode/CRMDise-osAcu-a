const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { env } = require('./config/env');
const { requestLogger } = require('./middleware/requestLogger');
const {
  healthRoutes,
  authRoutes,
  catalogRoutes,
  customersRoutes,
  ordersRoutes,
  reportsRoutes,
  uploadsRoutes,
  webhooksRoutes,
  designsRoutes,
  openapiRoutes,
  usersRoutes,
} = require('./routes');
const { notFound } = require('./middleware/notFound');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(requestLogger);
app.use(
  cors({
    origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((item) => item.trim()),
    credentials: true,
  })
);
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 200 }));

// Webhook routes (antes de JSON parsing - necesitan raw body)
app.use('/api/webhooks', webhooksRoutes);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/designs', designsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api', openapiRoutes);

app.get('/api', (_req, res) => {
  return res.status(200).json({
    name: 'Diseños Acuña API',
    version: '1.0.0',
    modules: ['auth', 'catalog', 'customers', 'orders', 'reports', 'inventory', 'users', 'openapi'],
  });
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
