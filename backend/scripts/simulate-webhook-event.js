const { pool } = require('../src/db/pool');
const webhookRoutes = require('../src/routes/webhooks.routes');

async function main() {
  const eventType = process.argv[2] || 'payment_intent.succeeded';
  const orderCode = process.argv[3];

  if (!orderCode) {
    throw new Error('Uso: node scripts/simulate-webhook-event.js <eventType> <orderCode>');
  }

  const orderResult = await pool.query(
    `SELECT id, order_code, status
     FROM orders
     WHERE order_code = $1
     LIMIT 1`,
    [orderCode]
  );

  const order = orderResult.rows[0];
  if (!order) {
    throw new Error(`No se encontró la orden ${orderCode}`);
  }

  const paymentIntentId = `pi_sim_${order.order_code.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
  const metadata = { orderId: order.id, orderCode: order.order_code };

  const handlers = webhookRoutes.__handlers;
  if (!handlers) {
    throw new Error('No se pudieron cargar los handlers del webhook');
  }

  if (eventType === 'payment_intent.succeeded') {
    await handlers.handlePaymentSucceeded({ id: paymentIntentId, metadata });
  } else if (eventType === 'payment_intent.payment_failed') {
    await handlers.handlePaymentFailed({ id: paymentIntentId, metadata });
  } else if (eventType === 'charge.failed') {
    await handlers.handleChargeFailed({ payment_intent: paymentIntentId, metadata });
  } else {
    throw new Error(`Evento no soportado: ${eventType}`);
  }

  const afterResult = await pool.query(
    `SELECT order_code, status
     FROM orders
     WHERE id = $1
     LIMIT 1`,
    [order.id]
  );

  console.log(JSON.stringify({
    simulatedEvent: eventType,
    orderCode: afterResult.rows[0].order_code,
    status: afterResult.rows[0].status,
    paymentIntentId,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('✗ Error:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });