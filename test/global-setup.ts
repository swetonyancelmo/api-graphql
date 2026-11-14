import { config } from 'dotenv';
import { Client } from 'pg';

export default async function globalSetup() {
  config({ quiet: true });

  const testDb = process.env.DB_TEST_NAME ?? 'estudos_graphql_test';
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: 'postgres',
  });

  await client.connect();
  try {
    const { rowCount } = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [testDb],
    );
    if (!rowCount) {
      await client.query(`CREATE DATABASE "${testDb}"`);
    }
  } finally {
    await client.end();
  }
}
