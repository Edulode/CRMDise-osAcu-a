const express = require('express');
const { env } = require('../config/env');
const stripe = env.stripeSecretKey ? require('stripe')(env.stripeSecretKey) : null;
const { pool } = require('../db/pool');
const { withTransaction } = require('../db/transaction');
const { ORDER_STATUSES, PAYMENT_STATUSES } = require('../config/constants');
const { sendPaymentConfirmedEmail } = require('../services/notification.service');
const { rollbackOrderAfterPaymentFailure } = require('../services/order-rollback.service');

const router = express.Router();

/**
 * POST /api/webhooks/stripe
 * Maneja eventos de Stripe webhooks
 * 
 * Eventos soportados:
 * - payment_intent.succeeded: Marca la orden como pagada
 * - payment_intent.payment_failed: Marca pago fallido y rollback
 * - charge.failed: fallback para rollback cuando falla el cargo
 */
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = env.stripeWebhookSecret;

    if (!stripe || !sig || !webhookSecret) {
      return res.status(503).json({ error: 'Stripe no está configurado en el servidor' });
    }

    // Verificar firma del webhook
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    console.log(`📨 Webhook recibido: ${event.type}`);

    // Manejar diferentes eventos
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      case 'charge.failed':
        await handleChargeFailed(event.data.object);
        break;
      default:
        console.log(`⚠️  Evento no manejado: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return next(error);
  }
});

/**
 * Maneja payment_intent.succeeded
 * Actualiza el estado de la orden a PAID
 */
async function handlePaymentSucceeded(paymentIntent) {
  try {
    const { id: paymentIntentId, metadata } = paymentIntent;
    const { orderCode, orderId } = metadata || {};

    if (!orderId && !orderCode) {
      console.warn('⚠️  Payment metadata incompleta:', { orderId, orderCode });
      return;
    }

    const order = await withTransaction(async (client) => {
      // Buscar la orden
      let orderRecord;
      
      if (orderId) {
        const result = await client.query(
          `SELECT o.id, o.order_code, o.status, o.total_amount, c.email, c.full_name
           FROM orders o
           INNER JOIN customers c ON c.id = o.customer_id
           WHERE o.id = $1`,
          [orderId]
        );
        orderRecord = result.rows[0];
      } else if (orderCode) {
        const result = await client.query(
          `SELECT o.id, o.order_code, o.status, o.total_amount, c.email, c.full_name
           FROM orders o
           INNER JOIN customers c ON c.id = o.customer_id
           WHERE o.order_code = $1`,
          [orderCode]
        );
        orderRecord = result.rows[0];
      }

      if (!orderRecord) {
        console.warn('⚠️  Orden no encontrada:', { orderId, orderCode });
        return null;
      }

      // Si ya está pagada, no hacer nada
      if (orderRecord.status === ORDER_STATUSES.PAID) {
        console.log(`ℹ️  Orden ${orderRecord.order_code} ya está pagada`);
        return orderRecord;
      }

      // Actualizar estado de la orden
      const updateResult = await client.query(
        `UPDATE orders
         SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, order_code, status, total_amount`,
        [ORDER_STATUSES.PAID, orderRecord.id]
      );

      // Registrar cambio de estado
      await client.query(
        `INSERT INTO order_status_history (order_id, from_status, to_status, notes)
         VALUES ($1, $2, $3, $4)`,
        [
          orderRecord.id,
          orderRecord.status,
          ORDER_STATUSES.PAID,
          `Pago confirmado por Stripe (ID: ${paymentIntentId})`,
        ]
      );

      // Actualizar estado del pago
      await client.query(
        `UPDATE payments
         SET status = $1, updated_at = NOW()
         WHERE provider_reference = $2 OR order_id = $3`,
        [PAYMENT_STATUSES.SUCCEEDED, paymentIntentId, orderRecord.id]
      );

      return {
        ...updateResult.rows[0],
        email: orderRecord.email,
        full_name: orderRecord.full_name,
      };
    });

    if (order) {
      console.log(`✅ Orden ${order.order_code} marcada como pagada`);

      // Enviar email de confirmación de pago (no bloquear si falla)
      await sendPaymentConfirmedEmail({
        to: order.email,
        orderCode: order.order_code,
        customerName: order.full_name,
        total: order.total_amount,
      }).catch((err) => {
        console.error('⚠️  Error enviando email de confirmación:', err.message);
      });
    }
  } catch (error) {
    console.error('❌ Error en handlePaymentSucceeded:', error);
    throw error;
  }
}

/**
 * Maneja payment_intent.payment_failed
 * Actualiza el estado del pago a FAILED
 */
async function handlePaymentFailed(paymentIntent) {
  try {
    const { id: paymentIntentId, metadata } = paymentIntent;
    const { orderCode, orderId } = metadata || {};

    if (!orderId && !orderCode) {
      console.warn('⚠️  Payment metadata incompleta:', { orderId, orderCode });
      return;
    }

    await withTransaction(async (client) => {
      // Buscar la orden
      let orderRecord;
      
      if (orderId) {
        const result = await client.query(
          `SELECT o.id, o.order_code, o.status
           FROM orders o
           WHERE o.id = $1`,
          [orderId]
        );
        orderRecord = result.rows[0];
      } else if (orderCode) {
        const result = await client.query(
          `SELECT o.id, o.order_code, o.status
           FROM orders o
           WHERE o.order_code = $1`,
          [orderCode]
        );
        orderRecord = result.rows[0];
      }

      if (!orderRecord) {
        console.warn('⚠️  Orden no encontrada:', { orderId, orderCode });
        return;
      }

      await rollbackOrderAfterPaymentFailure(client, {
        orderRecord,
        paymentIntentId,
      });
    });
  } catch (error) {
    console.error('❌ Error en handlePaymentFailed:', error);
    throw error;
  }
}

/**
 * Maneja charge.failed como respaldo
 */
async function handleChargeFailed(charge) {
  try {
    const paymentIntentId = charge?.payment_intent;
    if (!paymentIntentId) {
      console.warn('⚠️ charge.failed sin payment_intent asociado');
      return;
    }

    await handlePaymentFailed({
      id: paymentIntentId,
      metadata: charge?.metadata || {},
    });
  } catch (error) {
    console.error('❌ Error en handleChargeFailed:', error);
    throw error;
  }
}

module.exports = router;
