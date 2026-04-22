const express = require('express');
const { testConnection } = require('../db/pool');

const router = express.Router();

router.get('/health', async (_req, res) => {
  let database = 'disconnected';

  try {
    await testConnection();
    database = 'connected';
  } catch (_error) {
    database = 'disconnected';
  }

  return res.status(200).json({
    status: 'ok',
    database,
  });
});

router.get('/ready', async (_req, res) => {
  try {
    await testConnection();
    return res.status(200).json({ status: 'ready' });
  } catch (error) {
    return res.status(503).json({ status: 'not_ready', message: error.message });
  }
});

module.exports = router;
