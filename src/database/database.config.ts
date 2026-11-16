import { join } from 'path';
import { DataSourceOptions } from 'typeorm';
import { ProductEntity } from '../products/product.entity';
import { StockMovementEntity } from '../products/stock-movement.entity';
import { UserEntity } from '../users/user.entity';

export interface DatabaseEnv {
  DB_HOST?: string;
  DB_PORT?: string;
  DB_USER?: string;
  DB_PASSWORD?: string;
  DB_NAME?: string;
}

const MIGRATIONS_GLOB = join(
  __dirname,
  'migrations',
  __filename.endsWith('.ts') ? '*.ts' : '*.js',
);

export function buildDataSourceOptions(env: DatabaseEnv): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DB_HOST ?? 'localhost',
    port: Number(env.DB_PORT ?? 5432),
    username: env.DB_USER ?? 'postgres',
    password: env.DB_PASSWORD ?? 'postgres',
    database: env.DB_NAME ?? 'estudos_graphql',
    entities: [UserEntity, ProductEntity, StockMovementEntity],
    migrations: [MIGRATIONS_GLOB],
    synchronize: false,
    uuidExtension: 'pgcrypto',
    installExtensions: false,
  };
}
