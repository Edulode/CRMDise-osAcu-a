const bcrypt = require('bcryptjs');
const { pool } = require('../src/db/pool');
const { USER_ROLES } = require('../src/config/constants');

const staffUsers = [
  {
    fullName: process.env.STAFF_ADMIN_NAME || 'Admin CRM',
    email: process.env.STAFF_ADMIN_EMAIL || 'admin.crm@disenosacuna.com',
    password: process.env.STAFF_ADMIN_PASSWORD || 'AdminCRM123!',
    role: USER_ROLES.ADMIN,
  },
  {
    fullName: process.env.STAFF_EDITOR_NAME || 'Gerente CRM',
    email: process.env.STAFF_EDITOR_EMAIL || 'gerente.crm@disenosacuna.com',
    password: process.env.STAFF_EDITOR_PASSWORD || 'GerenteCRM123!',
    role: USER_ROLES.EDITOR,
  },
  {
    fullName: process.env.STAFF_COLLAB_NAME || 'Colaborador CRM',
    email: process.env.STAFF_COLLAB_EMAIL || 'colaborador.crm@disenosacuna.com',
    password: process.env.STAFF_COLLAB_PASSWORD || 'ColaboradorCRM123!',
    role: USER_ROLES.COLLABORATOR,
  },
];

async function upsertStaffUser(client, user) {
  const passwordHash = await bcrypt.hash(user.password, 12);
  const result = await client.query(
    `INSERT INTO users (full_name, email, password_hash, role, active, customer_id)
     VALUES ($1, $2, $3, $4, TRUE, NULL)
     ON CONFLICT (email)
     DO UPDATE SET
       full_name = EXCLUDED.full_name,
       password_hash = EXCLUDED.password_hash,
       role = EXCLUDED.role,
       active = TRUE,
       customer_id = NULL,
       updated_at = NOW()
     RETURNING id, full_name, email, role, active`,
    [user.fullName, user.email.toLowerCase(), passwordHash, user.role]
  );

  return result.rows[0];
}

async function createStaffUsers() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const created = [];
    for (const user of staffUsers) {
      const record = await upsertStaffUser(client, user);
      created.push({
        ...record,
        password: user.password,
      });
    }

    await client.query('COMMIT');

    console.log('✓ Usuarios internos CRM listos:');
    for (const user of created) {
      console.log(`- ${user.role}: ${user.email} / ${user.password}`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('✗ Error creando usuarios internos:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

createStaffUsers();
