const { pool } = require('../src/db/pool');

async function migrateUserRoles() {
  try {
    await pool.query('BEGIN');

    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_enum e
          INNER JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'user_role' AND e.enumlabel = 'editor'
        ) THEN
          ALTER TYPE user_role RENAME VALUE 'editor' TO 'gerente';
        END IF;

        IF EXISTS (
          SELECT 1
          FROM pg_enum e
          INNER JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'user_role' AND e.enumlabel = 'collaborator'
        ) THEN
          ALTER TYPE user_role RENAME VALUE 'collaborator' TO 'colaborador';
        END IF;
      END
      $$;
    `);

    await pool.query('COMMIT');
    console.log('✓ Roles migrados: editor→gerente, collaborator→colaborador');
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('✗ Error migrando roles:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrateUserRoles();
