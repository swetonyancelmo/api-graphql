import { DataSource } from 'typeorm';

/**
 * Falha rápido, com instrução clara, se o banco não estiver na versão do
 * código. Sem isso a API sobe e só quebra, de forma obscura, a cada requisição.
 */
export async function assertNoPendingMigrations(
  dataSource: DataSource,
): Promise<void> {
  if (await dataSource.showMigrations()) {
    throw new Error(
      'Há migrations pendentes no banco de dados. Execute `npm run migration:run` ' +
        '(em produção, `npm run migration:run:prod`) e inicie a aplicação novamente.',
    );
  }
}
