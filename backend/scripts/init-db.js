const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db/pool');

async function initDb() {
  const sqlFile = path.resolve(__dirname, '../sql/001_init.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('Schema aplicado correctamente desde sql/001_init.sql');
  } finally {
    client.release();
    await pool.end();
  }
}

initDb().catch((error) => {
  const reason = error && (error.message || error.code || String(error));
  console.error('No se pudo aplicar el schema:', reason);
  if (error && error.stack) {
    console.error(error.stack);
  }
  process.exitCode = 1;
});
