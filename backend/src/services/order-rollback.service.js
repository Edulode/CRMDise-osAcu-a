const { ORDER_STATUSES, PAYMENT_STATUSES } = require('../config/constants');

async function rollbackOrderAfterPaymentFailure(client, { orderRecord, paymentIntentId }) {
  await client.query(
    `UPDATE payments
     SET status = $1, updated_at = NOW()
     WHERE provider_reference = $2 OR order_id = $3`,
    [PAYMENT_STATUSES.FAILED, paymentIntentId, orderRecord.id]
  );

  if (orderRecord.status === ORDER_STATUSES.CANCELED) {
    console.log(`ℹ️  Orden ${orderRecord.order_code} ya estaba cancelada`);
    return { skipped: true };
  }

  const itemsResult = await client.query(
    `SELECT design_id, quantity
     FROM order_items
     WHERE order_id = $1`,
    [orderRecord.id]
  );

  for (const item of itemsResult.rows) {
    await client.query(
      `UPDATE inventory
       SET stock = stock + $1,
           reserved = GREATEST(COALESCE(reserved, 0) - $1, 0),
           updated_at = NOW()
       WHERE design_id = $2`,
      [item.quantity, item.design_id]
    );
  }

  await client.query(
    `UPDATE orders
     SET status = $1, updated_at = NOW()
     WHERE id = $2`,
    [ORDER_STATUSES.CANCELED, orderRecord.id]
  );

  await client.query(
    `INSERT INTO order_status_history (order_id, from_status, to_status, notes)
     VALUES ($1, $2, $3, $4)`,
    [
      orderRecord.id,
      orderRecord.status,
      ORDER_STATUSES.CANCELED,
      `Pago fallido en Stripe (ID: ${paymentIntentId}). Se liberó inventario.`,
    ]
  );

  console.log(`⚠️  Pago fallido para orden ${orderRecord.order_code}`);

  return {
    skipped: false,
    releasedItems: itemsResult.rows.length,
  };
}

module.exports = {
  rollbackOrderAfterPaymentFailure,
};