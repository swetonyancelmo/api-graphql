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
          updateProduct(id: "${id}", input: { unitPriceCents: 25000 }) { name quantity unitPriceCents }
        }`,
        token,
      ).expect(200);
      expect(updated.body.data.updateProduct).toEqual({
        name: 'Teclado',
        quantity: 10,
        unitPriceCents: 25000,
      });

      const removed = await gql(
        `mutation { deleteProduct(id: "${id}") { id name } }`,
        token,
      ).expect(200);
      expect(removed.body.data.deleteProduct).toEqual({ id, name: 'Teclado' });

      const list = await gql('{ products { id } }', token);
      expect(list.body.data.products).toEqual([]);
    });

    it('associa o produto criado ao usuário autenticado', async () => {
      const token = await authenticate();
      await createProduct(token);

      const [row] = await dataSource.query(
        'SELECT p."ownerId", u.id AS "userId" FROM products p JOIN users u ON u.id = p."ownerId"',
      );
      expect(row.ownerId).toBe(row.userId);
    });

    it('não aceita ownerId no input (o dono é sempre o usuário logado)', async () => {
      const token = await authenticate();
      const other = await signUp('outro@exemplo.com');
      const otherId = other.body.data.createUser.id;

      const res = await gql(
        `mutation {
          createProduct(input: {
            name: "X", description: "", quantity: 1, unitPriceCents: 1,
            ownerId: "${otherId}"
          }) { id }
        }`,
        token,
      );

      expect(res.body.errors[0].message).toContain('ownerId');
      const [{ count }] = await dataSource.query(
        'SELECT count(*) FROM products',
      );
      expect(count).toBe('0');
    });

    it('remove os produtos junto com o usuário (cascade)', async () => {
      const token = await authenticate();
      await createProduct(token);

      await dataSource.query('DELETE FROM users');

      const [{ count }] = await dataSource.query(
        'SELECT count(*) FROM products',
      );
      expect(count).toBe('0');
    });

    it('não permite alterar o estoque pelo updateProduct (só por adjustStock)', async () => {
      const token = await authenticate();
      const created = await createProduct(token, 10);
      const { id } = created.body.data.createProduct;

      const res = await gql(
        `mutation { updateProduct(id: "${id}", input: { quantity: 999 }) { id } }`,
        token,
      );

      expect(res.body.errors[0].message).toContain('quantity');
      const [row] = await dataSource.query('SELECT quantity FROM products');
      expect(row.quantity).toBe(10);
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
        `mutation { updateProduct(id: "${missing}", input: { name: "Novo" }) { id } }`,
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

  describe('ajuste de estoque', () => {
    let token: string;
    let productId: string;

    const adjust = (delta: number, id = productId, t = token) =>
      gql(
        `mutation { adjustStock(id: "${id}", input: { delta: ${delta} }) { id quantity } }`,
        t,
      );

    const currentQuantity = async (): Promise<number> => {
      const [row] = await dataSource.query('SELECT quantity FROM products');
      return row.quantity as number;
    };

    beforeEach(async () => {
      token = await authenticate();
      const created = await createProduct(token, 10);
      productId = created.body.data.createProduct.id;
    });

    it('registra entrada e saída de estoque', async () => {
      const entrada = await adjust(5);
      expect(entrada.body.data.adjustStock).toEqual({
        id: productId,
        quantity: 15,
      });

      const saida = await adjust(-4);
      expect(saida.body.data.adjustStock.quantity).toBe(11);
      expect(await currentQuantity()).toBe(11);
    });

    it('permite zerar o estoque exatamente', async () => {
      const res = await adjust(-10);

      expect(res.body.data.adjustStock.quantity).toBe(0);
    });

    it('rejeita saída maior que o estoque e não altera o saldo', async () => {
      const res = await adjust(-11);

      expect(res.body.errors[0].message).toContain('Estoque insuficiente');
      expect(res.body.errors[0].message).toContain('há 10 unidade(s)');
      expect(await currentQuantity()).toBe(10);
    });

    it('rejeita variação zero e fora do limite', async () => {
      for (const delta of [0, 1_000_001, -1_000_001]) {
        const res = await adjust(delta);
        expect(res.body.errors[0].extensions.code).toBe('BAD_REQUEST');
      }
      expect(await currentQuantity()).toBe(10);
    });

    it('rejeita variação não inteira', async () => {
      const res = await gql(
        `mutation { adjustStock(id: "${productId}", input: { delta: 1.5 }) { id } }`,
        token,
      );

      expect(res.body.errors).toBeDefined();
      expect(await currentQuantity()).toBe(10);
    });

    it('rejeita entrada que ultrapassa o estoque máximo', async () => {
      await dataSource.query('UPDATE products SET quantity = 999999999');

      const res = await adjust(2);

      expect(res.body.errors[0].message).toContain('não pode ultrapassar');
      expect(await currentQuantity()).toBe(999999999);
    });

    it('retorna erro para produto inexistente', async () => {
      const res = await adjust(1, '00000000-0000-0000-0000-000000000000');

      expect(res.body.errors[0].message).toContain('não encontrado');
    });

    it('não permite ajustar o estoque de outro usuário', async () => {
      const outro = await authenticate('outro@exemplo.com');

      const res = await adjust(-1, productId, outro);

      expect(res.body.errors[0].message).toContain('não encontrado');
      expect(await currentQuantity()).toBe(10);
    });

    it('exige autenticação', async () => {
      const res = await gql(
        `mutation { adjustStock(id: "${productId}", input: { delta: 1 }) { id } }`,
      );

      expect(res.body.errors[0].message).toBe('Token de acesso ausente.');
    });

    describe('concorrência', () => {
      it('20 saídas simultâneas de 1 em um estoque de 10: exatamente 10 passam', async () => {
        const results = await Promise.all(
          Array.from({ length: 20 }, () => adjust(-1)),
        );

        const succeeded = results.filter((r) => r.body.data?.adjustStock);
        const failed = results.filter((r) => r.body.errors);
        expect(succeeded).toHaveLength(10);
        expect(failed).toHaveLength(10);
        expect(await currentQuantity()).toBe(0);
      });

      it('nunca deixa o estoque negativo com saídas de tamanhos diferentes', async () => {
        // 5 saídas de 3 em um estoque de 10: só 3 cabem (9), sobra 1.
        const results = await Promise.all(
          Array.from({ length: 5 }, () => adjust(-3)),
        );

        expect(results.filter((r) => r.body.data?.adjustStock)).toHaveLength(3);
        expect(await currentQuantity()).toBe(1);
      });

      it('não perde atualizações quando entradas e saídas se misturam', async () => {
        // 10 entradas de +2 e 10 saídas de -1, todas simultâneas: saldo final = 10 + 20 - 10.
        const results = await Promise.all([
          ...Array.from({ length: 10 }, () => adjust(2)),
          ...Array.from({ length: 10 }, () => adjust(-1)),
        ]);

        expect(results.every((r) => r.body.data?.adjustStock)).toBe(true);
        expect(await currentQuantity()).toBe(20);
      });
    });
  });

  describe('histórico de estoque', () => {
    let token: string;

    const newProduct = async (quantity: number) => {
      const res = await createProduct(token, quantity);
      return res.body.data.createProduct.id as string;
    };

    const adjust = (id: string, delta: number, reason?: string, t = token) =>
      gql(
        `mutation {
          adjustStock(id: "${id}", input: { delta: ${delta}${
            reason ? `, reason: "${reason}"` : ''
          } }) { quantity }
        }`,
        t,
      );

    const movements = (id: string, args = '', t = token) =>
      gql(
        `{ stockMovements(productId: "${id}"${args}) { delta quantityAfter reason createdAt } }`,
        t,
      );

    const dbCount = async (): Promise<number> => {
      const [{ count }] = await dataSource.query(
        'SELECT count(*) FROM stock_movements',
      );
      return Number(count);
    };

    beforeEach(async () => {
      token = await authenticate();
    });

    it('registra o estoque inicial ao criar o produto', async () => {
      const id = await newProduct(10);

      const res = await movements(id);

      expect(res.body.data.stockMovements).toEqual([
        expect.objectContaining({
          delta: 10,
          quantityAfter: 10,
          reason: 'Estoque inicial',
        }),
      ]);
    });

    it('não registra movimentação quando o estoque inicial é zero', async () => {
      const id = await newProduct(0);

      const res = await movements(id);

      expect(res.body.data.stockMovements).toEqual([]);
    });

    it('registra cada ajuste com variação, saldo resultante e motivo, do mais recente ao mais antigo', async () => {
      const id = await newProduct(10);
      await adjust(id, -3, 'Venda');
      await adjust(id, 5, 'Compra');
      await adjust(id, -1);

      const res = await movements(id);

      expect(
        res.body.data.stockMovements.map(
          (m: {
            delta: number;
            quantityAfter: number;
            reason: string | null;
          }) => [m.delta, m.quantityAfter, m.reason],
        ),
      ).toEqual([
        [-1, 11, null],
        [5, 12, 'Compra'],
        [-3, 7, 'Venda'],
        [10, 10, 'Estoque inicial'],
      ]);
    });

    it('não registra nada quando o ajuste é rejeitado', async () => {
      const id = await newProduct(2);
      const before = await dbCount();

      const res = await adjust(id, -5, 'Venda');

      expect(res.body.errors[0].message).toContain('Estoque insuficiente');
      expect(await dbCount()).toBe(before);
    });

    it('desfaz o ajuste se o registro do histórico falhar (transação)', async () => {
      const id = await newProduct(10);
      // Força uma falha no INSERT do histórico, depois do UPDATE do produto.
      await dataSource.query(
        `ALTER TABLE stock_movements ADD CONSTRAINT falha_forcada
         CHECK (reason IS DISTINCT FROM 'falha-forcada')`,
      );

      try {
        const res = await adjust(id, -4, 'falha-forcada');
        expect(res.body.errors).toBeDefined();
      } finally {
        await dataSource.query(
          'ALTER TABLE stock_movements DROP CONSTRAINT falha_forcada',
        );
      }

      const [row] = await dataSource.query('SELECT quantity FROM products');
      expect(row.quantity).toBe(10);
      expect(await dbCount()).toBe(1); // só o estoque inicial
    });

    it('pagina com limit e offset', async () => {
      const id = await newProduct(10);
      await adjust(id, -1);
      await adjust(id, -1);
      await adjust(id, -1);

      const first = await movements(id, ', limit: 2');
      const second = await movements(id, ', limit: 2, offset: 2');

      expect(
        first.body.data.stockMovements.map(
          (m: { quantityAfter: number }) => m.quantityAfter,
        ),
      ).toEqual([7, 8]);
      expect(
        second.body.data.stockMovements.map(
          (m: { quantityAfter: number }) => m.quantityAfter,
        ),
      ).toEqual([9, 10]);
    });

    it('valida limit, offset e o formato do ID', async () => {
      const id = await newProduct(1);

      for (const args of [', limit: 0', ', limit: 101', ', offset: -1']) {
        const res = await movements(id, args);
        expect(res.body.errors[0].extensions.code).toBe('BAD_REQUEST');
      }
      const bad = await gql(
        '{ stockMovements(productId: "nao-e-uuid") { delta } }',
        token,
      );
      expect(bad.body.errors[0].extensions.code).toBe('BAD_REQUEST');
    });

    it('rejeita motivo maior que 200 caracteres', async () => {
      const id = await newProduct(10);

      const res = await adjust(id, 1, 'x'.repeat(201));

      expect(res.body.errors[0].extensions.code).toBe('BAD_REQUEST');
      expect(await dbCount()).toBe(1);
    });

    it('não permite ver o histórico de produto de outro usuário', async () => {
      const id = await newProduct(10);
      const outro = await authenticate('outro@exemplo.com');

      const res = await movements(id, '', outro);

      expect(res.body.errors[0].message).toContain('não encontrado');
    });

    it('exige autenticação', async () => {
      const id = await newProduct(10);

      const res = await gql(`{ stockMovements(productId: "${id}") { delta } }`);

      expect(res.body.errors[0].message).toBe('Token de acesso ausente.');
    });

    it('remove o histórico junto com o produto', async () => {
      const id = await newProduct(10);
      await adjust(id, -1);

      await gql(`mutation { deleteProduct(id: "${id}") { id } }`, token);

      expect(await dbCount()).toBe(0);
    });

    it('mantém a consistência do livro-razão sob ajustes concorrentes', async () => {
      const id = await newProduct(10);

      // 30 ajustes simultâneos: parte passa, parte é recusada por falta de estoque.
      await Promise.all([
        ...Array.from({ length: 15 }, () => adjust(id, -1)),
        ...Array.from({ length: 10 }, () => adjust(id, 2)),
        ...Array.from({ length: 5 }, () => adjust(id, -4)),
      ]);

      const res = await movements(id, ', limit: 100');
      const history: { delta: number; quantityAfter: number }[] =
        res.body.data.stockMovements.reverse(); // do mais antigo ao mais recente
      const [{ quantity }] = await dataSource.query(
        'SELECT quantity FROM products',
      );

      // 1) Cada saldo é o anterior mais a variação: nenhuma movimentação se perdeu
      //    nem foi gravada fora de ordem.
      history.forEach((m, i) => {
        const previous = i === 0 ? 0 : history[i - 1].quantityAfter;
        expect(m.quantityAfter).toBe(previous + m.delta);
        expect(m.quantityAfter).toBeGreaterThanOrEqual(0);
      });
      // 2) O último saldo do histórico é o saldo real, e a soma das variações bate.
      expect(history[history.length - 1].quantityAfter).toBe(quantity);
      expect(history.reduce((sum, m) => sum + m.delta, 0)).toBe(quantity);
    });
  });

  describe('isolamento entre usuários', () => {
    let tokenA: string;
    let tokenB: string;
    let productId: string;

    beforeEach(async () => {
      tokenA = await authenticate('a@exemplo.com');
      tokenB = await authenticate('b@exemplo.com');
      const created = await createProduct(tokenA);
      productId = created.body.data.createProduct.id;
    });

    it('cada usuário lista apenas os próprios produtos', async () => {
      await createProduct(tokenB, 3);

      const a = await gql('{ products { id quantity } }', tokenA);
      const b = await gql('{ products { id quantity } }', tokenB);

      expect(a.body.data.products).toHaveLength(1);
      expect(a.body.data.products[0].id).toBe(productId);
      expect(b.body.data.products).toHaveLength(1);
      expect(b.body.data.products[0].quantity).toBe(3);
    });

    it('outro usuário não consegue ler o produto (retorna null)', async () => {
      const res = await gql(
        `{ product(id: "${productId}") { id name } }`,
        tokenB,
      );

      expect(res.body.data.product).toBeNull();
    });

    it('outro usuário não consegue atualizar o produto', async () => {
      const res = await gql(
        `mutation { updateProduct(id: "${productId}", input: { name: "Invadido" }) { id } }`,
        tokenB,
      );

      expect(res.body.errors[0].message).toContain('não encontrado');
      const [row] = await dataSource.query('SELECT name FROM products');
      expect(row.name).toBe('Teclado');
    });

    it('outro usuário não consegue remover o produto', async () => {
      const res = await gql(
        `mutation { deleteProduct(id: "${productId}") { id } }`,
        tokenB,
      );

      expect(res.body.errors[0].message).toContain('não encontrado');
      const [{ count }] = await dataSource.query(
        'SELECT count(*) FROM products',
      );
      expect(count).toBe('1');
    });

    it('a resposta para produto alheio é igual à de produto inexistente', async () => {
      const missing = '00000000-0000-0000-0000-000000000000';
      const foreign = await gql(
        `mutation { deleteProduct(id: "${productId}") { id } }`,
        tokenB,
      );
      const absent = await gql(
        `mutation { deleteProduct(id: "${missing}") { id } }`,
        tokenB,
      );

      // Só o ID na mensagem muda, então não dá para descobrir se o ID existe.
      const normalize = (msg: string) => msg.replace(/[0-9a-f-]{36}/, '<id>');
      expect(normalize(foreign.body.errors[0].message)).toBe(
        normalize(absent.body.errors[0].message),
      );
    });

    it('o dono continua conseguindo acessar o produto', async () => {
      const res = await gql(`{ product(id: "${productId}") { name } }`, tokenA);

      expect(res.body.data.product).toEqual({ name: 'Teclado' });
    });
  });
});
