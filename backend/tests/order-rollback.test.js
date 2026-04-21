const test = require('node:test');
const assert = require('node:assert/strict');

const { rollbackOrderAfterPaymentFailure } = require('../src/services/order-rollback.service');

test('rollbackOrderAfterPaymentFailure restores inventory and cancels the order', async () => {
  const queries = [];
  const client = {
    async query(text, params) {
      queries.push({ text, params });

      if (text.includes('SELECT design_id, quantity')) {
        return {
          rows: [
            { design_id: 'design-a', quantity: 2 },
            { design_id: 'design-b', quantity: 1 },
          ],
        };
      }

      return { rows: [], rowCount: 0 };
    },
  };

  const result = await rollbackOrderAfterPaymentFailure(client, {
    orderRecord: {
      id: 'order-1',
      order_code: 'DAC-TEST-001',
      status: 'pending',
    },
    paymentIntentId: 'pi_test_123',
  });

  assert.deepEqual(result, { skipped: false, releasedItems: 2 });
  assert.equal(queries.length, 6);
  assert.match(queries[0].text, /UPDATE payments/i);
  assert.match(queries[1].text, /SELECT design_id, quantity/i);
  assert.match(queries[2].text, /UPDATE inventory/i);
  assert.equal(queries[2].params[0], 2);
  assert.match(queries[3].text, /UPDATE inventory/i);
  assert.equal(queries[3].params[0], 1);
  assert.match(queries[4].text, /UPDATE orders/i);
  assert.match(queries[5].text, /INSERT INTO order_status_history/i);
  assert.equal(queries[5].params[3], 'Pago fallido en Stripe (ID: pi_test_123). Se liberó inventario.');
});

test('rollbackOrderAfterPaymentFailure skips inventory rollback when already canceled', async () => {
  const queries = [];
  const client = {
    async query(text, params) {
      queries.push({ text, params });
      return { rows: [], rowCount: 0 };
    },
  };

  const result = await rollbackOrderAfterPaymentFailure(client, {
    orderRecord: {
      id: 'order-2',
      order_code: 'DAC-TEST-002',
      status: 'canceled',
    },
    paymentIntentId: 'pi_test_456',
  });

  assert.deepEqual(result, { skipped: true });
  assert.equal(queries.length, 1);
  assert.match(queries[0].text, /UPDATE payments/i);
});