const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('node:crypto');

const { app } = require('../src/server');
const { pool } = require('../src/db/pool');
const { USER_ROLES } = require('../src/config/constants');

let server;
let baseUrl;
const createdEmails = [];
let adminToken;
let adminId;

async function requestJson(path, options = {}) {
  const { headers: optionHeaders, ...requestOptions } = options;
  const response = await fetch(`${baseUrl}${path}`, {
    ...requestOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(optionHeaders ?? {}),
    },
  });

  const body = await (response.headers.get('content-type')?.includes('application/json') ? response.json() : null);
  return { response, body };
}

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  // Create an admin user directly in DB
  const adminEmail = `qa.admin.${randomUUID().slice(0, 8)}@example.com`;
  const password = 'AdminTest123!';
  const passwordHash = await bcrypt.hash(password, 12);

  const result = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, active, customer_id)
     VALUES ($1, $2, $3, $4, TRUE, NULL)
     RETURNING id, email`,
    ['QA Admin', adminEmail, passwordHash, USER_ROLES.ADMIN]
  );

  adminId = result.rows[0].id;
  createdEmails.push(adminEmail);

  // Login to obtain token
  const login = await requestJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: adminEmail, password }),
  });

  assert.equal(login.response.status, 200);
  adminToken = login.body.token;
});

test.after(async () => {
  // cleanup created users
  if (createdEmails.length > 0) {
    await pool.query('DELETE FROM users WHERE email = ANY($1::text[])', [createdEmails]);
  }

  await new Promise((resolve) => server.close(resolve));
});

test('admin can create, update and delete staff users', async () => {
  const staffEmail = `qa.staff.${randomUUID().slice(0, 8)}@example.com`;
  createdEmails.push(staffEmail);

  // Create staff user
  const create = await requestJson('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      fullName: 'QA Gerente',
      email: staffEmail,
      password: 'Staff123!',
      role: USER_ROLES.EDITOR,
      active: true,
    }),
  });

  assert.equal(create.response.status, 201, JSON.stringify(create.body));
  const created = create.body.data;
  assert.equal(created.email, staffEmail);
  assert.equal(created.role, USER_ROLES.EDITOR);

  // List users filtered by role
  const list = await requestJson(`/api/users?role=${USER_ROLES.EDITOR}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  assert.equal(list.response.status, 200);
  assert.ok(list.body.data.some((u) => u.email === staffEmail));

  // Update staff user
  const update = await requestJson(`/api/users/${created.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ fullName: 'QA Gerente Updated' }),
  });

  assert.equal(update.response.status, 200);
  assert.equal(update.body.data.full_name, 'QA Gerente Updated');

  // Admin cannot delete self: try to demote self should fail (ensure protection)
  const demoteSelf = await requestJson(`/api/users/${adminId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ role: USER_ROLES.COLLABORATOR }),
  });

  assert.equal(demoteSelf.response.status, 409);

  // Delete created staff
  const del = await requestJson(`/api/users/${created.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  assert.equal(del.response.status, 200);
});
