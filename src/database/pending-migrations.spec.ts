import { DataSource } from 'typeorm';
import { assertNoPendingMigrations } from './pending-migrations';

describe('assertNoPendingMigrations', () => {
  const dataSourceWith = (pending: boolean) =>
    ({
      showMigrations: jest.fn().mockResolvedValue(pending),
    }) as unknown as DataSource;

  it('não faz nada quando o banco está atualizado', async () => {
    await expect(
      assertNoPendingMigrations(dataSourceWith(false)),
    ).resolves.toBeUndefined();
  });

  it('falha indicando o comando para aplicar as migrations', async () => {
    await expect(
      assertNoPendingMigrations(dataSourceWith(true)),
    ).rejects.toThrow('npm run migration:run');
  });
});
