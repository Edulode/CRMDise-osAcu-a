const { sendEmail, isEmailEnabled } = require('../src/services/notification.service');
const http = require('http');

const apiBase = process.env.MONITOR_API_BASE || 'http://backend:4000';
const checkIntervalMs = Number(process.env.MONITOR_INTERVAL_MS || 60000);
const cooldownMs = Number(process.env.MONITOR_ALERT_COOLDOWN_MS || 300000);
const alertEmailTo = process.env.MONITOR_ALERT_EMAIL_TO || process.env.SENDGRID_FROM_EMAIL || '';
const alertWebhookUrl = process.env.MONITOR_ALERT_WEBHOOK_URL || '';
const maxDbLatencyMs = Number(process.env.MONITOR_DB_LATENCY_MS_THRESHOLD || 500);
const alertListenerPort = Number(process.env.MONITOR_ALERT_LISTEN_PORT || 8080);

let lastAlertAt = 0;

function now() {
  return Date.now();
}

function canAlert() {
  return now() - lastAlertAt >= cooldownMs;
}

async function sendWebhookAlert(payload) {
  if (!alertWebhookUrl) {
    return;
  }

  await fetch(alertWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function notifyAlert(subject, details) {
  if (!canAlert()) {
    return;
  }

  lastAlertAt = now();

  if (alertEmailTo && isEmailEnabled()) {
    await sendEmail({
      to: alertEmailTo,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; line-height:1.5; color:#1f2937;">
          <h2 style="margin:0 0 8px;">Alerta operativa - Diseños Acuña</h2>
          <p>${details}</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-MX')}</p>
        </div>
      `,
    }).catch(() => null);
  }

  await sendWebhookAlert({
    level: 'critical',
    service: 'disenos-acuna-backend',
    subject,
    details,
    at: new Date().toISOString(),
  }).catch(() => null);
}

function startAlertWebhookServer() {
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/internal/alert') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'not_found' }));
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];
        const summary = alerts[0]?.annotations?.summary || 'Alerta de infraestructura';
        const details = alerts[0]?.annotations?.description || 'Alertmanager reportó una condición de alerta';

        await notifyAlert(`Alertmanager: ${summary}`, details);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'received' }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: error?.message || 'invalid_payload' }));
      }
    });
  });

  server.listen(alertListenerPort, () => {
    console.log(`Monitor webhook listener activo en puerto ${alertListenerPort}`);
  });
}

async function checkHealth() {
  const healthRes = await fetch(`${apiBase}/health`);
  if (!healthRes.ok) {
    throw new Error(`Health endpoint respondió ${healthRes.status}`);
  }

  const health = await healthRes.json();
  if (health.database !== 'connected') {
    throw new Error('Base de datos desconectada');
  }

  if (Number(health.databaseLatencyMs || 0) > maxDbLatencyMs) {
    throw new Error(`Latencia de DB alta: ${health.databaseLatencyMs}ms`);
  }

  const readyRes = await fetch(`${apiBase}/ready`);
  if (!readyRes.ok) {
    throw new Error(`Ready endpoint respondió ${readyRes.status}`);
  }

  console.log(JSON.stringify({
    type: 'monitor',
    status: 'ok',
    databaseLatencyMs: health.databaseLatencyMs ?? null,
    at: new Date().toISOString(),
  }));
}

async function monitorLoop() {
  try {
    await checkHealth();
  } catch (error) {
    const details = error?.message || 'Error desconocido en monitor de salud';
    console.error(JSON.stringify({ type: 'monitor', status: 'error', details, at: new Date().toISOString() }));
    await notifyAlert('Alerta de salud del backend', details);
  }
}

console.log(`Monitor activo contra ${apiBase} cada ${checkIntervalMs}ms`);
startAlertWebhookServer();
monitorLoop();
setInterval(monitorLoop, checkIntervalMs);