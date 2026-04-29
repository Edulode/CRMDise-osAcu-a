const { pool } = require('../src/db/pool');

async function cleanupCustomers() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const orderIds = await client.query(
      `SELECT o.id
       FROM orders o
       INNER JOIN customers c ON c.id = o.customer_id
       WHERE c.email IS NOT NULL`
    );

    if (orderIds.rowCount > 0) {
      await client.query('DELETE FROM orders WHERE id = ANY($1::uuid[])', [orderIds.rows.map((row) => row.id)]);
    }

    await client.query("DELETE FROM users WHERE role = 'customer'");
    await client.query('DELETE FROM design_drafts');
    await client.query('DELETE FROM customers');

    await client.query('COMMIT');

    console.log('✓ Base de datos de clientes limpiada');
    console.log('✓ Ordenes, usuarios customer, drafts y clientes eliminados');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('✗ Error limpiando clientes:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupCustomers();
