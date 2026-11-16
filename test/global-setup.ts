import { execFileSync } from 'child_process';
import { config } from 'dotenv';
import { Client } from 'pg';

export default async function globalSetup() {
  config({ quiet: true });

  const testDb = process.env.DB_TEST_NAME ?? 'estudos_graphql_test';
  const connection = {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
  };

  const admin = new Client({ ...connection, database: 'postgres' });
  await admin.connect();
  try {
    const { rowCount } = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [testDb],
    );
    if (!rowCount) {
      await admin.query(`CREATE DATABASE "${testDb}"`);
    }
  } finally {
    await admin.end();
  }

  const db = new Client({ ...connection, database: testDb });
  await db.connect();
  try {
    await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  } finally {
    await db.end();
  }

  try {
    execFileSync('npm', ['run', 'migration:run'], {
      env: { ...process.env, DB_NAME: testDb },
      stdio: 'pipe',
    });
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      `Falha ao aplicar as migrations no banco de testes:\n${stdout?.toString() ?? ''}${stderr?.toString() ?? ''}`,
    );
  }
}
