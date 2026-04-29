const bcrypt = require('bcryptjs');
const { pool } = require('../src/db/pool');
const { USER_ROLES } = require('../src/config/constants');

const DEMO_ADMIN = {
  fullName: process.env.DEMO_ADMIN_NAME || 'Admin Demo',
  email: process.env.DEMO_ADMIN_EMAIL || 'admin.demo@disenosacuna.com',
  password: process.env.DEMO_ADMIN_PASSWORD || 'AdminDemo123!',
  role: USER_ROLES.ADMIN,
};

const DEMO_CUSTOMER = {
  fullName: process.env.DEMO_CUSTOMER_NAME || 'Cliente Demo',
  email: process.env.DEMO_CUSTOMER_EMAIL || 'cliente.demo@disenosacuna.com',
  password: process.env.DEMO_CUSTOMER_PASSWORD || 'ClienteDemo123!',
  phone: process.env.DEMO_CUSTOMER_PHONE || '5512345678',
};

async function upsertCustomer(client, customer) {
  const result = await client.query(
    `INSERT INTO customers (full_name, email, phone, event_type, preferred_style, consent_given)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     ON CONFLICT (email)
     DO UPDATE SET
       full_name = EXCLUDED.full_name,
       phone = EXCLUDED.phone,
       event_type = EXCLUDED.event_type,
       preferred_style = EXCLUDED.preferred_style,
       updated_at = NOW()
     RETURNING id, full_name, email`,
    [customer.fullName, customer.email, customer.phone, 'Boda', 'Elegante']
  );

  return result.rows[0];
}

async function upsertUser(client, { fullName, email, password, role, customerId = null }) {
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await client.query(
    `INSERT INTO users (full_name, email, password_hash, role, customer_id, active)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     ON CONFLICT (email)
     DO UPDATE SET
       full_name = EXCLUDED.full_name,
       password_hash = EXCLUDED.password_hash,
       role = EXCLUDED.role,
       customer_id = EXCLUDED.customer_id,
       active = TRUE,
       updated_at = NOW()
     RETURNING id, full_name, email, role, customer_id`,
    [fullName, email, passwordHash, role, customerId]
  );

  return result.rows[0];
}

async function resetSecurityStateForDemoUsers(client, userIds) {
  if (userIds.length === 0) {
    return;
  }

  await client.query('DELETE FROM user_mfa WHERE user_id = ANY($1::uuid[])', [userIds]);
  await client.query('DELETE FROM auth_refresh_tokens WHERE user_id = ANY($1::uuid[])', [userIds]);
}

async function createDemoUsers() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const customer = await upsertCustomer(client, DEMO_CUSTOMER);

    const adminUser = await upsertUser(client, {
      fullName: DEMO_ADMIN.fullName,
      email: DEMO_ADMIN.email,
      password: DEMO_ADMIN.password,
      role: DEMO_ADMIN.role,
      customerId: null,
    });

    const customerUser = await upsertUser(client, {
      fullName: DEMO_CUSTOMER.fullName,
      email: DEMO_CUSTOMER.email,
      password: DEMO_CUSTOMER.password,
      role: USER_ROLES.CUSTOMER,
      customerId: customer.id,
    });

    await resetSecurityStateForDemoUsers(client, [adminUser.id, customerUser.id]);

    await client.query('COMMIT');

    console.log('Demo setup listo. Usuarios de video:');
    console.log('-----------------------------------');
    console.log(`Admin    : ${DEMO_ADMIN.email} / ${DEMO_ADMIN.password}`);
    console.log(`Cliente  : ${DEMO_CUSTOMER.email} / ${DEMO_CUSTOMER.password}`);
    console.log(`CustomerId demo: ${customer.id}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('No se pudieron crear usuarios demo:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

createDemoUsers();
