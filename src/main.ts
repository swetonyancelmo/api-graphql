import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { setupApp } from './app.setup';
import { assertNoPendingMigrations } from './database/pending-migrations';

async function bootstrap() {
  const app = setupApp(await NestFactory.create(AppModule));

  await assertNoPendingMigrations(app.get(DataSource));

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error(
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
