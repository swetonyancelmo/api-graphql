import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';

describe('API GraphQL (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const gql = (query: string) =>
    request(app.getHttpServer()).post('/graphql').send({ query });

  const createUser = (email = 'ana@exemplo.com') =>
    gql(`mutation {
      createUser(input: { name: "Ana", email: "${email}", password: "segredo123" }) {
        id name email
      }
    }`);

  const createProduct = (quantity = 10) =>
    gql(`mutation {
      createProduct(input: {
        name: "Teclado", description: "Mecânico",
        quantity: ${quantity}, unitPriceCents: 19990
      }) { id name quantity unitPriceCents }
    }`);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = setupApp(moduleRef.createNestApplication());
    await app.init();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE users, products CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  it('usa o banco de testes, e não o de desenvolvimento', () => {
    expect(dataSource.options.database).toMatch(/_test$/);
  });

  describe('users', () => {
    it('cria e lista usuários sem expor a senha', async () => {
      const created = await createUser().expect(200);
      expect(created.body.data.createUser).toMatchObject({
        name: 'Ana',
        email: 'ana@exemplo.com',
      });

      const list = await gql('{ users { id name email } }').expect(200);
      expect(list.body.data.users).toHaveLength(1);
    });

    it('não permite consultar o campo password', async () => {
      const res = await gql('{ users { password } }');

      expect(res.body.errors).toBeDefined();
      expect(res.body.data).toBeUndefined();
    });

    it('guarda a senha como hash no banco', async () => {
      await createUser();

      const [row] = await dataSource.query('SELECT password FROM users');
      expect(row.password).not.toBe('segredo123');
      expect(row.password).toMatch(/^\$2[aby]\$/);
    });

    it('rejeita email duplicado', async () => {
      await createUser();
      const res = await createUser();

      expect(res.body.errors[0].message).toBe(
        'Já existe um usuário com este email.',
      );
    });

    it('rejeita dados inválidos', async () => {
      const res = await gql(`mutation {
        createUser(input: { name: "", email: "invalido", password: "123" }) { id }
      }`);

      expect(res.body.errors[0].extensions.code).toBe('BAD_REQUEST');
    });

    it('retorna null ao buscar usuário inexistente', async () => {
      const res = await gql(
        '{ user(id: "00000000-0000-0000-0000-000000000000") { id } }',
      ).expect(200);

      expect(res.body.data.user).toBeNull();
    });
  });

  describe('products', () => {
    it('cria, atualiza parcialmente e remove um produto', async () => {
      const created = await createProduct().expect(200);
      const { id } = created.body.data.createProduct;
      expect(created.body.data.createProduct).toMatchObject({
        quantity: 10,
        unitPriceCents: 19990,
      });

      const updated = await gql(`mutation {
        updateProduct(id: "${id}", input: { quantity: 7 }) { name quantity unitPriceCents }
      }`).expect(200);
      expect(updated.body.data.updateProduct).toEqual({
        name: 'Teclado',
        quantity: 7,
        unitPriceCents: 19990,
      });

      const removed = await gql(
        `mutation { deleteProduct(id: "${id}") { id name } }`,
      ).expect(200);
      expect(removed.body.data.deleteProduct).toEqual({ id, name: 'Teclado' });

      const list = await gql('{ products { id } }');
      expect(list.body.data.products).toEqual([]);
    });

    it('rejeita quantidade negativa', async () => {
      const res = await createProduct(-5);

      expect(res.body.errors[0].extensions.code).toBe('BAD_REQUEST');
    });

    it('retorna erro ao atualizar ou remover produto inexistente', async () => {
      const missing = '00000000-0000-0000-0000-000000000000';

      const update = await gql(
        `mutation { updateProduct(id: "${missing}", input: { quantity: 1 }) { id } }`,
      );
      const remove = await gql(
        `mutation { deleteProduct(id: "${missing}") { id } }`,
      );

      expect(update.body.errors[0].message).toContain('não encontrado');
      expect(remove.body.errors[0].message).toContain('não encontrado');
    });
  });
});
