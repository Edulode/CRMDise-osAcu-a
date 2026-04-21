const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const { app } = require('../src/server');
const { pool } = require('../src/db/pool');

let server;
let baseUrl;
const createdEmails = [];
let createdOrderCode = null;

async function requestJson(path, options = {}) {
  const { headers: optionHeaders, ...requestOptions } = options;
  const response = await fetch(`${baseUrl}${path}`, {
    ...requestOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(optionHeaders ?? {}),
    },
  });

  const body = await response.json();
  return { response, body };
}

async function registerCustomer(fullName, email) {
  createdEmails.push(email);

  const { response, body } = await requestJson('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      fullName,
      email,
      password: 'QaTest123!',
      consent: true,
    }),
  });

  assert.equal(response.status, 201);
  return body;
}

async function getCustomerIdByEmail(email) {
  const result = await pool.query('SELECT id FROM customers WHERE email = $1 LIMIT 1', [email]);
  assert.equal(result.rowCount, 1);
  return result.rows[0].id;
}

async function getAnyActiveDesignId() {
  const result = await pool.query('SELECT id FROM designs WHERE active = true ORDER BY created_at DESC LIMIT 1');
  assert.equal(result.rowCount, 1);
  return result.rows[0].id;
}

async function cleanup() {
  if (createdOrderCode) {
    await pool.query('DELETE FROM orders WHERE order_code = $1', [createdOrderCode]);
  }

  if (createdEmails.length > 0) {
    await pool.query('DELETE FROM users WHERE email = ANY($1::text[])', [createdEmails]);
    await pool.query('DELETE FROM customers WHERE email = ANY($1::text[])', [createdEmails]);
  }
}

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await cleanup();
  await new Promise((resolve) => server.close(resolve));
});

test('a customer cannot read another customer order history', async () => {
  const customerEmailA = `qa.owner.${randomUUID().slice(0, 8)}@example.com`;
  const customerEmailB = `qa.other.${randomUUID().slice(0, 8)}@example.com`;

  const customerA = await registerCustomer('Cliente A', customerEmailA);
  const customerB = await registerCustomer('Cliente B', customerEmailB);
  const designId = await getAnyActiveDesignId();
  const customerIdA = await getCustomerIdByEmail(customerEmailA);

  const checkout = await requestJson('/api/orders/checkout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${customerA.token}`,
    },
    body: JSON.stringify({
      customerId: customerIdA,
      items: [
        {
          designId,
          quantity: 1,
          personalizationData: {},
        },
      ],
      shippingPrice: 0,
    }),
  });

  assert.equal(checkout.response.status, 201, JSON.stringify(checkout.body));
  createdOrderCode = checkout.body.data.order_code;

  const listAsOwner = await requestJson('/api/orders', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${customerA.token}`,
    },
  });

  assert.equal(listAsOwner.response.status, 200);
  assert.ok(listAsOwner.body.data.some((order) => order.order_code === createdOrderCode));

  const listAsOtherCustomer = await requestJson('/api/orders', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${customerB.token}`,
    },
  });

  assert.equal(listAsOtherCustomer.response.status, 200);
  assert.ok(!listAsOtherCustomer.body.data.some((order) => order.order_code === createdOrderCode));

  const historyAsOtherCustomer = await requestJson(`/api/orders/${checkout.body.data.id}/history`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${customerB.token}`,
    },
  });

  assert.equal(historyAsOtherCustomer.response.status, 404);
});