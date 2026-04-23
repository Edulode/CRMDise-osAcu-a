const bcrypt = require('bcryptjs');
const { pool } = require('../src/db/pool');

async function createTestUser() {
  try {
    const fullName = process.env.TEST_USER_NAME || 'Test User';
    const email = process.env.TEST_USER_EMAIL || 'test@disenosacuna.com';
    const password = process.env.TEST_USER_PASSWORD || 'TestPassword123';
    const role = process.env.TEST_USER_ROLE || 'customer';
    const passwordHash = await bcrypt.hash(password, 12);

    await pool.query('DELETE FROM users WHERE email = $1', [email]);

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, active)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id, full_name, email, role`,
      [fullName, email, passwordHash, role]
    );

    console.log('✓ Usuario de prueba creado:');
    console.log(result.rows[0]);
    console.log('\nCredenciales:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log(`Role: ${role}`);

  } catch (error) {
    console.error('✗ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

createTestUser();
