const { testConnection, pool } = require('../src/db/pool');

async function checkDb() {
  await testConnection();
  console.log('Conexion a PostgreSQL OK');
  await pool.end();
}

checkDb().catch((error) => {
  const reason = error && (error.message || error.code || String(error));
  console.error('Conexion a PostgreSQL fallida:', reason);
  if (error && error.stack) {
    console.error(error.stack);
  }
  process.exitCode = 1;
});
