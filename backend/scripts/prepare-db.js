const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { env } = require('../src/config/env');

function adminConnectionConfig() {
  if (env.databaseUrl) {
    // If DATABASE_URL is set, reuse it for admin tasks and connect to the default postgres DB.
    const url = new URL(env.databaseUrl);
    url.pathname = '/postgres';
    return {
      connectionString: url.toString(),
    };
  }

  return {
    host: env.dbHost,
    port: env.dbPort,
    user: env.dbUser,
    password: env.dbPassword,
    database: 'postgres',
  };
}

function appConnectionConfig() {
  if (env.databaseUrl) {
    return { connectionString: env.databaseUrl };
  }

  return {
    host: env.dbHost,
    port: env.dbPort,
    user: env.dbUser,
    password: env.dbPassword,
    database: env.dbName,
  };
}

async function ensureDatabase() {
  const adminClient = new Client(adminConnectionConfig());
  await adminClient.connect();

  try {
    const existing = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [env.dbName]);
    if (existing.rowCount > 0) {
      console.log(`Base de datos ${env.dbName} ya existe`);
      return;
    }

    await adminClient.query(`CREATE DATABASE "${env.dbName}"`);
    console.log(`Base de datos ${env.dbName} creada`);
  } finally {
    await adminClient.end();
  }
}

async function applySchema() {
  const sqlFile = path.resolve(__dirname, '../sql/001_init.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');
  const appClient = new Client(appConnectionConfig());

  await appClient.connect();
  try {
    await appClient.query(sql);
    console.log('Schema aplicado correctamente');
  } finally {
    await appClient.end();
  }
}

async function prepareDb() {
  await ensureDatabase();
  await applySchema();
}

prepareDb().catch((error) => {
  const reason = error && (error.message || error.code || String(error));
  console.error('Fallo preparando base de datos:', reason);
  if (error && error.stack) {
    console.error(error.stack);
  }
  process.exitCode = 1;
});
