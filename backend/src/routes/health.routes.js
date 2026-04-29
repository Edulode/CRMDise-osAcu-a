const express = require('express');
const { testConnection } = require('../db/pool');

const router = express.Router();

const startedAt = Date.now();

function processMetrics() {
  const memory = process.memoryUsage();
  return {
    uptimeSeconds: Math.floor(process.uptime()),
    rssBytes: memory.rss,
    heapTotalBytes: memory.heapTotal,
    heapUsedBytes: memory.heapUsed,
    startedAt: new Date(startedAt).toISOString(),
    now: new Date().toISOString(),
  };
}

router.get('/health', async (_req, res) => {
  let database = 'disconnected';
  let databaseLatencyMs = null;

  try {
    const probeStart = Date.now();
    await testConnection();
    database = 'connected';
    databaseLatencyMs = Date.now() - probeStart;
  } catch (_error) {
    database = 'disconnected';
  }

  return res.status(200).json({
    status: 'ok',
    database,
    databaseLatencyMs,
    process: processMetrics(),
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

router.get('/metrics', async (_req, res) => {
  let dbUp = 0;
  let dbLatency = 0;

  try {
    const probeStart = Date.now();
    await testConnection();
    dbUp = 1;
    dbLatency = Date.now() - probeStart;
  } catch (_error) {
    dbUp = 0;
    dbLatency = 0;
  }

  const metrics = processMetrics();
  const payload = [
    '# HELP app_uptime_seconds Application uptime in seconds',
    '# TYPE app_uptime_seconds gauge',
    `app_uptime_seconds ${metrics.uptimeSeconds}`,
    '# HELP app_memory_rss_bytes Resident set size memory in bytes',
    '# TYPE app_memory_rss_bytes gauge',
    `app_memory_rss_bytes ${metrics.rssBytes}`,
    '# HELP app_memory_heap_used_bytes Heap used memory in bytes',
    '# TYPE app_memory_heap_used_bytes gauge',
    `app_memory_heap_used_bytes ${metrics.heapUsedBytes}`,
    '# HELP db_up Database availability (1 up, 0 down)',
    '# TYPE db_up gauge',
    `db_up ${dbUp}`,
    '# HELP db_latency_ms Database probe latency in milliseconds',
    '# TYPE db_latency_ms gauge',
    `db_latency_ms ${dbLatency}`,
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  return res.status(200).send(`${payload}\n`);
});

module.exports = router;
