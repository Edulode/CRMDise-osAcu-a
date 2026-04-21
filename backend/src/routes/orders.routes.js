const express = require('express');
const { pool } = require('../db/pool');
const { withTransaction } = require('../db/transaction');
const { authenticateToken, optionalAuth, requireRole, requireOwnershipOrder } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ORDER_STATUSES, USER_ROLES, PAYMENT_STATUSES } = require('../config/constants');
const { checkoutSchema, orderStatusSchema } = require('../validators/order.validators');
const { calculateOrderTotals } = require('../utils/pricing');
const { createPublicCode } = require('../utils/id');
const { createPaymentIntent } = require('../services/payment.service');
const { sendOrderConfirmationEmail } = require('../services/notification.service');

const router = express.Router();

/**
 * Obtiene el customer_id del JWT token
 * Nota: Siempre retorna customer_id (estandarizado)
 */
function getCustomerIdFromToken(user) {
  return user?.customer_id ?? null;
}

async function loadCustomerFromPayload(client, payload) {
  if (payload.customerId) {
    const customerResult = await client.query('SELECT id, full_name, email, phone FROM customers WHERE id = $1 LIMIT 1', [payload.customerId]);
    if (customerResult.rowCount === 0) {
      const error = new Error('Cliente no encontrado');
      error.statusCode = 404;
      throw error;
    }

    return customerResult.rows[0];
  }

  if (!payload.customer) {
    const error = new Error('Debes enviar customerId o customer');
    error.statusCode = 400;
    throw error;
  }

  const customerResult = await client.query(
    `INSERT INTO customers (full_name, email, phone, event_type, preferred_style, notes, consent_given)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, full_name, email, phone`,
    [
      payload.customer.fullName,
      payload.customer.email,
      payload.customer.phone ?? null,
      payload.customer.eventType ?? null,
      payload.customer.preferredStyle ?? null,
      payload.customer.notes ?? null,
      payload.customer.consentGiven,
    ]
  );

  return customerResult.rows[0];
}

router.get('/', authenticateToken, requireRole(USER_ROLES.ADMIN, USER_ROLES.EDITOR, USER_ROLES.COLLABORATOR, USER_ROLES.CUSTOMER), async (req, res, next) => {
  try {
    const values = [];
    const conditions = ['1 = 1'];
    const customerId = getCustomerIdFromToken(req.user);

    if (req.user.role === USER_ROLES.CUSTOMER && customerId) {
      values.push(customerId);
      conditions.push(`o.customer_id = $${values.length}`);
    }

    const result = await pool.query(
      `SELECT o.id, o.order_code, o.status, o.total_amount, o.created_at, c.full_name AS customer_name, c.email AS customer_email
       FROM orders o
       INNER JOIN customers c ON c.id = o.customer_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY o.created_at DESC`,
      values
    );

    return res.status(200).json({ data: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/checkout', optionalAuth, validate(checkoutSchema), async (req, res, next) => {
  try {
    const payload = req.body;

    const order = await withTransaction(async (client) => {
      const customer = await loadCustomerFromPayload(client, payload);
      const designRows = [];

      for (const item of payload.items) {
        const designResult = await client.query(
          `SELECT d.id, d.name, d.base_price, d.personalization_price
           FROM designs d
           WHERE d.id = $1
           LIMIT 1
           FOR UPDATE`,
          [item.designId]
        );

        if (designResult.rowCount === 0) {
          const error = new Error('Diseño no encontrado');
          error.statusCode = 404;
          throw error;
        }

        const design = designResult.rows[0];

        const inventoryResult = await client.query(
          `SELECT design_id, stock, reserved
           FROM inventory
           WHERE design_id = $1
           FOR UPDATE`,
          [item.designId]
        );

        const inventory =
          inventoryResult.rowCount > 0
            ? inventoryResult.rows[0]
            : {
                design_id: item.designId,
                stock: 0,
                reserved: 0,
              };

        const availableStock = Number(inventory.stock ?? 0);
        if (availableStock < item.quantity) {
          const error = new Error(`Inventario insuficiente para ${design.name}`);
          error.statusCode = 409;
          throw error;
        }

        designRows.push({
          design: {
            ...design,
            stock: inventory.stock,
            reserved: inventory.reserved,
          },
          item,
        });
      }

      const totals = designRows.reduce(
        (accumulator, current) => {
          const itemTotals = calculateOrderTotals({
            basePrice: current.design.base_price,
            personalizationPrice: current.design.personalization_price,
            shippingPrice: 0,
            quantity: current.item.quantity,
          });

          accumulator.subtotal += itemTotals.subtotal;
          accumulator.total += itemTotals.subtotal;
          return accumulator;
        },
        { subtotal: 0, shippingPrice: Number(payload.shippingPrice ?? 0), total: 0 }
      );

      totals.total += totals.shippingPrice;

      const orderCode = createPublicCode('DAC');
      const orderResult = await client.query(
        `INSERT INTO orders (order_code, customer_id, user_id, status, subtotal_amount, shipping_amount, total_amount, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, order_code, status, subtotal_amount, shipping_amount, total_amount, customer_id`,
        [
          orderCode,
          customer.id,
          req.user?.sub ?? null,
          ORDER_STATUSES.PENDING,
          totals.subtotal,
          totals.shippingPrice,
          totals.total,
          payload.notes ?? null,
        ]
      );

      for (const current of designRows) {
        const itemTotals = calculateOrderTotals({
          basePrice: current.design.base_price,
          personalizationPrice: current.design.personalization_price,
          shippingPrice: 0,
          quantity: current.item.quantity,
        });

        await client.query(
          `INSERT INTO order_items (order_id, design_id, quantity, base_price, personalization_price, shipping_price, total_price, personalization_data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            orderResult.rows[0].id,
            current.design.id,
            current.item.quantity,
            current.design.base_price,
            current.design.personalization_price,
            0,
            itemTotals.subtotal,
            current.item.personalizationData ?? {},
          ]
        );

        await client.query(
          `UPDATE inventory
           SET reserved = COALESCE(reserved, 0) + $1,
               stock = stock - $1,
               updated_at = NOW()
           WHERE design_id = $2`,
          [current.item.quantity, current.design.id]
        );
      }

      await client.query(
        `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderResult.rows[0].id, null, ORDER_STATUSES.PENDING, req.user?.sub ?? null, payload.notes ?? null]
      );

      const paymentIntent = await createPaymentIntent({
        amount: totals.total * 100,
        metadata: { orderCode, orderId: orderResult.rows[0].id },
      });

      await client.query(
        `INSERT INTO payments (order_id, provider, provider_reference, amount, currency, status, tokenized)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          orderResult.rows[0].id,
          paymentIntent.provider,
          paymentIntent.id ?? paymentIntent.clientSecret ?? orderCode,
          totals.total,
          'mxn',
          PAYMENT_STATUSES.PENDING,
          Boolean(payload.paymentToken),
        ]
      );

      return {
        ...orderResult.rows[0],
        paymentIntent,
        customer,
      };
    });

    await sendOrderConfirmationEmail({
      to: order.customer.email,
      orderCode: order.order_code,
      customerName: order.customer.full_name,
      total: order.total_amount,
    }).catch(() => null);

    return res.status(201).json({ data: order });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/status', authenticateToken, requireRole(USER_ROLES.ADMIN, USER_ROLES.COLLABORATOR), validate(orderStatusSchema), async (req, res, next) => {
  try {
    const updated = await withTransaction(async (client) => {
      const current = await client.query('SELECT id, status FROM orders WHERE id = $1 LIMIT 1', [req.params.id]);
      if (current.rowCount === 0) {
        const error = new Error('Pedido no encontrado');
        error.statusCode = 404;
        throw error;
      }

      const result = await client.query(
        `UPDATE orders
         SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, order_code, status, total_amount, updated_at`,
        [req.body.status, req.params.id]
      );

      await client.query(
        `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.params.id, current.rows[0].status, req.body.status, req.user.sub, req.body.notes ?? null]
      );

      return result.rows[0];
    });

    return res.status(200).json({ data: updated });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/orders/:id
 * Obtiene detalle de una orden específica
 * - Admin/Editor/Collaborator: acceso a cualquier orden
 * - Customer: solo acceso a órdenes propias
 * Usa middleware requireOwnershipOrder para validación
 */
router.get('/:id', authenticateToken, requireOwnershipOrder(pool), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT 
         o.id, o.order_code, o.status, o.total_amount, o.subtotal_amount, o.shipping_amount,
         o.created_at, o.updated_at, o.notes,
         c.full_name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
         COALESCE(json_agg(
           json_build_object(
             'id', oi.id,
             'design_id', oi.design_id,
             'design_name', d.name,
             'quantity', oi.quantity,
             'base_price', oi.base_price,
             'personalization_price', oi.personalization_price,
             'total_price', oi.total_price,
             'personalization_data', oi.personalization_data
           )
         ) FILTER (WHERE oi.id IS NOT NULL), '[]'::json) AS items
       FROM orders o
       INNER JOIN customers c ON c.id = o.customer_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN designs d ON d.id = oi.design_id
       WHERE o.id = $1
       GROUP BY o.id, c.id`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Pedido no encontrado' });
    }

    return res.status(200).json({ data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/orders/:id/history
 * Obtiene el historial de cambios de estado de una orden
 * - Admin/Editor/Collaborator: acceso a cualquier orden
 * - Customer: solo acceso a órdenes propias
 * Usa middleware requireOwnershipOrder para validación
 */
router.get('/:id/history', authenticateToken, requireOwnershipOrder(pool), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, from_status, to_status, notes, created_at
       FROM order_status_history
       WHERE order_id = $1
       ORDER BY created_at ASC`,
      [req.params.id]
    );

    return res.status(200).json({ data: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', authenticateToken, requireRole(USER_ROLES.ADMIN, USER_ROLES.COLLABORATOR), async (req, res, next) => {
  try {
    const updated = await withTransaction(async (client) => {
      const current = await client.query('SELECT id, status FROM orders WHERE id = $1 LIMIT 1', [req.params.id]);
      if (current.rowCount === 0) {
        const error = new Error('Pedido no encontrado');
        error.statusCode = 404;
        throw error;
      }

      if (current.rows[0].status === ORDER_STATUSES.CANCELED) {
        return { alreadyCanceled: true };
      }

      const result = await client.query(
        `UPDATE orders
         SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, order_code, status, updated_at`,
        [ORDER_STATUSES.CANCELED, req.params.id]
      );

      await client.query(
        `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.params.id, current.rows[0].status, ORDER_STATUSES.CANCELED, req.user.sub, 'Cancelado desde panel admin']
      );

      return result.rows[0];
    });

    return res.status(200).json({ data: updated });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
