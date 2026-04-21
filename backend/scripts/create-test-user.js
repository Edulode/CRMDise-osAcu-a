const bcrypt = require('bcryptjs');
const { pool } = require('../src/db/pool');

async function createTestUser() {
  try {
    const passwordHash = await bcrypt.hash('TestPassword123', 12);

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, role`,
      ['Test User', 'test@disenosacuna.com', passwordHash, 'customer']
    );

    console.log('✓ Usuario de prueba creado:');
    console.log(result.rows[0]);
    console.log('\nCredenciales:');
    console.log('Email: test@disenosacuna.com');
    console.log('Password: TestPassword123');

  } catch (error) {
    console.error('✗ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

createTestUser();
