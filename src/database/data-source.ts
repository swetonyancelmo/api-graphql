import { existsSync } from 'fs';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './database.config';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default new DataSource(buildDataSourceOptions(process.env));
