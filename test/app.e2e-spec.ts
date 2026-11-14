import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';

describe('API GraphQL (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  const PASSWORD = 'segredo123';

  const gql = (query: string, token?: string) => {
    const req = request(app.getHttpServer()).post('/graphql');
    if (token) req.set('Authorization', `Bearer ${token}`);
    return req.send({ query });
  };

  const signUp = (email = 'ana@exemplo.com') =>
    gql(`mutation {
      createUser(input: { name: "Ana", email: "${email}", password: "${PASSWORD}" }) {
        id name email
      }
    }`);

  const login = (email = 'ana@exemplo.com', password = PASSWORD) =>
    gql(`mutation {
      login(input: { email: "${email}", password: "${password}" }) { accessToken }
    }`);

  /** Cadastra um usuário, faz login e devolve o token de acesso. */
  const authenticate = async (email = 'ana@exemplo.com') => {
    await signUp(email);
    const res = await login(email);
    return res.body.data.login.accessToken as string;
  };

  const createProduct = (token?: string, quantity = 10) =>
    gql(
      `mutation {
        createProduct(input: {
          name: "Teclado", description: "Mecânico",
          quantity: ${quantity}, unitPriceCents: 19990
        }) { id name quantity unitPriceCents }
      }`,
      token,
    );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = setupApp(moduleRef.createNestApplication());
    await app.init();
    dataSource = app.get(DataSource);
    jwtService = app.get(JwtService);
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

  describe('autenticação', () => {
    it('permite cadastro sem token (createUser é público)', async () => {
      const res = await signUp().expect(200);

      expect(res.body.data.createUser).toMatchObject({
        email: 'ana@exemplo.com',
      });
    });

    it('faz login com credenciais válidas e devolve um JWT', async () => {
      await signUp();
      const res = await login().expect(200);

      expect(res.body.data.login.accessToken).toMatch(
        /^[\w-]+\.[\w-]+\.[\w-]+$/,
      );
    });

    it('rejeita senha incorreta e email inexistente com a mesma mensagem', async () => {
      await signUp();

      const wrongPassword = await login('ana@exemplo.com', 'senha-errada');
      const unknownEmail = await login('ninguem@exemplo.com');

      expect(wrongPassword.body.errors[0].message).toBe(
        'Credenciais inválidas.',
      );
      expect(unknownEmail.body.errors[0].message).toBe(
        'Credenciais inválidas.',
      );
      expect(wrongPassword.body.data).toBeNull();
    });

    it('retorna o usuário autenticado na query me', async () => {
      const token = await authenticate();

      const res = await gql('{ me { name email } }', token).expect(200);

      expect(res.body.data.me).toEqual({
        name: 'Ana',
        email: 'ana@exemplo.com',
      });
    });

    it('bloqueia rotas protegidas sem token', async () => {
      const queries = [
        '{ me { id } }',
        '{ users { id } }',
        '{ products { id } }',
        'mutation { deleteProduct(id: "00000000-0000-0000-0000-000000000000") { id } }',
      ];

      for (const query of queries) {
        const res = await gql(query);
        expect(res.body.errors[0].message).toBe('Token de acesso ausente.');
        expect(res.body.data).toBeNull();
      }
    });

    it('bloqueia token malformado', async () => {
      const res = await gql('{ me { id } }', 'isto-nao-e-um-jwt');

      expect(res.body.errors[0].message).toBe('Token inválido ou expirado.');
    });

    it('bloqueia token expirado', async () => {
      await signUp();
      const [{ id }] = await dataSource.query('SELECT id FROM users');
      const expired = await jwtService.signAsync(
        { sub: id, email: 'ana@exemplo.com' },
        { expiresIn: -10 },
      );

      const res = await gql('{ me { id } }', expired);

      expect(res.body.errors[0].message).toBe('Token inválido ou expirado.');
    });

    it('bloqueia token assinado com outro segredo', async () => {
      await signUp();
      const [{ id }] = await dataSource.query('SELECT id FROM users');
      const forged = await jwtService.signAsync(
        { sub: id, email: 'ana@exemplo.com' },
        { secret: 'outro-segredo-qualquer-com-mais-de-32-caracteres' },
      );

      const res = await gql('{ me { id } }', forged);

      expect(res.body.errors[0].message).toBe('Token inválido ou expirado.');
    });

    it('bloqueia token de um usuário que foi removido', async () => {
      const token = await authenticate();
      await dataSource.query('DELETE FROM users');

      const res = await gql('{ me { id } }', token);

      expect(res.body.errors[0].message).toBe('Token inválido ou expirado.');
    });
  });

  describe('users', () => {
    it('lista usuários sem expor a senha', async () => {
      const token = await authenticate();

      const list = await gql('{ users { id name email } }', token).expect(200);

      expect(list.body.data.users).toHaveLength(1);
    });

    it('não permite consultar o campo password', async () => {
      const token = await authenticate();

      const res = await gql('{ users { password } }', token);

      expect(res.body.errors[0].message).toContain(
        'Cannot query field "password"',
      );
      expect(res.body.data).toBeUndefined();
    });

    it('guarda a senha como hash no banco', async () => {
      await signUp();

      const [row] = await dataSource.query('SELECT password FROM users');
      expect(row.password).not.toBe(PASSWORD);
      expect(row.password).toMatch(/^\$2[aby]\$/);
    });

    it('rejeita email duplicado', async () => {
      await signUp();
      const res = await signUp();

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
      const token = await authenticate();

      const res = await gql(
        '{ user(id: "00000000-0000-0000-0000-000000000000") { id } }',
        token,
      ).expect(200);

      expect(res.body.data.user).toBeNull();
    });
  });

  describe('products', () => {
    it('cria, atualiza parcialmente e remove um produto', async () => {
      const token = await authenticate();

      const created = await createProduct(token).expect(200);
      const { id } = created.body.data.createProduct;
      expect(created.body.data.createProduct).toMatchObject({
        quantity: 10,
        unitPriceCents: 19990,
      });

      const updated = await gql(
        `mutation {
          updateProduct(id: "${id}", input: { quantity: 7 }) { name quantity unitPriceCents }
        }`,
        token,
      ).expect(200);
      expect(updated.body.data.updateProduct).toEqual({
        name: 'Teclado',
        quantity: 7,
        unitPriceCents: 19990,
      });

      const removed = await gql(
        `mutation { deleteProduct(id: "${id}") { id name } }`,
        token,
      ).expect(200);
      expect(removed.body.data.deleteProduct).toEqual({ id, name: 'Teclado' });

      const list = await gql('{ products { id } }', token);
      expect(list.body.data.products).toEqual([]);
    });

    it('rejeita quantidade negativa', async () => {
      const token = await authenticate();

      const res = await createProduct(token, -5);

      expect(res.body.errors[0].extensions.code).toBe('BAD_REQUEST');
    });

    it('retorna erro ao atualizar ou remover produto inexistente', async () => {
      const token = await authenticate();
      const missing = '00000000-0000-0000-0000-000000000000';

      const update = await gql(
        `mutation { updateProduct(id: "${missing}", input: { quantity: 1 }) { id } }`,
        token,
      );
      const remove = await gql(
        `mutation { deleteProduct(id: "${missing}") { id } }`,
        token,
      );

      expect(update.body.errors[0].message).toContain('não encontrado');
      expect(remove.body.errors[0].message).toContain('não encontrado');
    });
  });
});
