# Estudos GraphQL

API GraphQL construída com **NestJS**, **Apollo Server**, **TypeORM** e **PostgreSQL**, desenvolvida como projeto de estudo para praticar boas práticas de back-end: camadas bem separadas, validação, persistência real, testes e CI.

![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)
![GraphQL](https://img.shields.io/badge/GraphQL-16-E10098?logo=graphql&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-compose-2496ED?logo=docker&logoColor=white)

## Sumário

- [Stack](#stack)
- [Status do projeto](#status-do-projeto)
- [Como rodar](#como-rodar)
- [Exemplos de uso](#exemplos-de-uso)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Decisões de design](#decisões-de-design)
- [Roadmap](#roadmap)
- [Scripts](#scripts)

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | NestJS 11 |
| API | GraphQL (abordagem *code-first*) com Apollo Server 5 |
| Banco de dados | PostgreSQL 16 |
| ORM | TypeORM |
| Validação | class-validator + class-transformer |
| Segurança | bcrypt (hash de senha) e JWT (`@nestjs/jwt`) |
| Configuração | @nestjs/config + `.env` |
| Infra local | Docker Compose |
| Qualidade | ESLint, Prettier, Jest |

## Status do projeto

O projeto está em evolução. O que já existe e o que está planejado:

- [x] API GraphQL com schema gerado automaticamente (`src/schema.gql`)
- [x] Módulo de usuários: listar, buscar por ID e criar
- [x] Validação de entrada com mensagens customizadas
- [x] Persistência em PostgreSQL com TypeORM
- [x] IDs em UUID
- [x] Senha armazenada com hash bcrypt, nunca exposta no schema
- [x] Bloqueio de email duplicado
- [x] PostgreSQL via Docker Compose
- [x] Configuração por variáveis de ambiente
- [x] Testes unitários (services) e e2e (GraphQL + PostgreSQL de teste)
- [ ] Migrations (hoje o TypeORM usa `synchronize`, só para desenvolvimento)
- [x] Autenticação com JWT: `login`, guard global, `@Public()` e `@CurrentUser()`
- [x] Módulo de produtos com relação 1:N com `User`: cada usuário só enxerga e altera os próprios produtos
- [x] Ajuste de estoque atômico (`adjustStock`), com proteção contra estoque negativo sob concorrência
- [x] Histórico de movimentações de estoque (`stockMovements`), gravado na mesma transação do ajuste
- [ ] DataLoader para evitar N+1
- [ ] Paginação, filtros e ordenação
- [ ] Subscriptions
- [ ] Tratamento de erros customizado (`formatError`)
- [ ] CI com GitHub Actions
- [ ] Dockerfile multi-stage e deploy

Veja detalhes no [Roadmap](#roadmap).

## Como rodar

### Pré-requisitos

- Node.js 20 ou superior
- Docker e Docker Compose

### Passo a passo

```bash
# 1. Instale as dependências
npm install

# 2. Crie o arquivo de ambiente
cp .env.example .env

# 3. Suba o PostgreSQL
docker compose up -d

# 4. Inicie a API em modo desenvolvimento
npm run start:dev
```

Abra o Apollo Sandbox em **http://localhost:3000/graphql** para explorar o schema e executar queries.

Para parar o banco: `docker compose down` (adicione `-v` para apagar também os dados).

### Variáveis de ambiente

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `PORT` | `3000` | Porta da API |
| `DB_HOST` | `localhost` | Host do PostgreSQL |
| `DB_PORT` | `5432` | Porta do PostgreSQL |
| `DB_USER` | `postgres` | Usuário do banco |
| `DB_PASSWORD` | `postgres` | Senha do banco |
| `DB_NAME` | `estudos_graphql` | Nome do banco |
| `JWT_SECRET` | *(obrigatória)* | Segredo de assinatura do JWT, com no mínimo 32 caracteres. Gere com `openssl rand -base64 48` |
| `JWT_EXPIRES_IN` | `1h` | Validade do token (ex.: `15m`, `1h`, `7d`) |
| `DB_TEST_NAME` | `estudos_graphql_test` | Banco usado pelos testes e2e (criado automaticamente) |

## Exemplos de uso

### Criar um usuário

```graphql
mutation {
  createUser(
    input: { name: "Ana", email: "ana@exemplo.com", password: "segredo123" }
  ) {
    id
    name
    email
  }
}
```

### Fazer login

`createUser` e `login` são públicas. Todas as outras operações exigem token.

```graphql
mutation {
  login(input: { email: "ana@exemplo.com", password: "segredo123" }) {
    accessToken
  }
}
```

Envie o token no header de todas as demais requisições (no Apollo Sandbox, em *Headers*):

```json
{ "Authorization": "Bearer <accessToken>" }
```

### Consultar o usuário autenticado

```graphql
query {
  me {
    id
    name
    email
  }
}
```

### Listar usuários

```graphql
query {
  users {
    id
    name
    email
  }
}
```

### Buscar um usuário por ID

```graphql
query {
  user(id: "COLE-O-UUID-AQUI") {
    name
    email
  }
}
```

### Gerenciar produtos

Todas as operações de produto exigem token e atuam apenas nos produtos do usuário logado. O preço é informado em centavos (`19990` = R$ 199,90).

```graphql
mutation {
  createProduct(
    input: { name: "Teclado", description: "Mecânico", quantity: 10, unitPriceCents: 19990 }
  ) {
    id
    name
    quantity
    unitPriceCents
  }
}

query { products { id name quantity } }

mutation { updateProduct(id: "UUID", input: { name: "Teclado Gamer", unitPriceCents: 25000 }) { id name unitPriceCents } }

mutation { deleteProduct(id: "UUID") { id name } }
```

### Ajustar o estoque

A quantidade só é definida na criação do produto (saldo inicial). Depois disso, o estoque muda exclusivamente por `adjustStock`; o `updateProduct` não aceita `quantity`.

`delta` positivo registra uma entrada e negativo, uma saída. A operação é atômica: o estoque nunca fica negativo, mesmo com várias requisições simultâneas.

```graphql
mutation {
  adjustStock(id: "UUID", input: { delta: -3 }) {
    id
    quantity
  }
}
```

Opcionalmente, informe um motivo (até 200 caracteres) para constar no histórico:

```graphql
mutation {
  adjustStock(id: "UUID", input: { delta: -3, reason: "Venda" }) {
    quantity
  }
}
```

Regras: `delta` é um inteiro diferente de zero, entre -1.000.000 e 1.000.000; o estoque fica entre 0 e 1.000.000.000. Uma saída maior que o saldo responde *"Estoque insuficiente: há N unidade(s) e a saída é de M."* e não altera nada.

### Consultar o histórico de estoque

Lista as movimentações de um produto, da mais recente para a mais antiga. Criar um produto com `quantity > 0` registra a entrada inicial (*"Estoque inicial"*). `limit` (1 a 100, padrão 20) e `offset` paginam o resultado.

```graphql
query {
  stockMovements(productId: "UUID", limit: 10, offset: 0) {
    delta
    quantityAfter
    reason
    createdAt
  }
}
```

A soma dos `delta` de um produto é sempre igual ao seu `quantity`, e o `quantityAfter` de cada linha é o saldo anterior mais o `delta`.

Acessar, alterar ou remover o produto de outro usuário responde como se ele não existisse (`product` retorna `null`; `updateProduct` e `deleteProduct` retornam "não encontrado"), para não revelar IDs alheios.

### Erros esperados

- Sem token, token malformado, expirado ou de usuário removido: `UNAUTHENTICATED`. O login com senha errada e com email inexistente devolvem a mesma mensagem (*"Credenciais inválidas."*), para não revelar quais emails existem.
- Email já cadastrado: `409 Conflict` com a mensagem *"Já existe um usuário com este email."*
- Dados inválidos (nome vazio, email malformado, senha com menos de 6 caracteres): `400 Bad Request` com as mensagens de validação.

## Estrutura de pastas

```text
src/
├── app.module.ts            # Módulo raiz: config, TypeORM e GraphQL
├── main.ts                  # Bootstrap
├── app.setup.ts             # ValidationPipe global (compartilhado com os testes e2e)
├── schema.gql               # Schema gerado automaticamente
├── auth/
│   ├── auth.module.ts             # JwtModule + guard global (APP_GUARD)
│   ├── auth.service.ts            # Valida credenciais e assina o JWT
│   ├── auth.resolver.ts           # Mutation `login`
│   ├── jwt-auth.guard.ts          # Valida o Bearer token e carrega o usuário
│   └── decorators/                # @Public() e @CurrentUser()
├── products/
│   ├── product.entity.ts          # Tabela `products` (FK `ownerId` → `users`, índice, cascade)
│   ├── product.service.ts         # Toda consulta é filtrada pelo dono; ajustes em transação
│   ├── stock-movement.entity.ts   # Livro-razão do estoque (tabela `stock_movements`)
│   ├── product.resolver.ts        # Usa @CurrentUser() para obter o dono
│   └── dto/                       # Inputs de criação e atualização parcial
└── users/
    ├── dto/
    │   └── create-user.input.ts   # Input da mutation + regras de validação
    ├── user.entity.ts             # Entidade TypeORM (tabela `users`)
    ├── user.object-type.ts        # Tipo exposto no GraphQL
    ├── users.resolver.ts          # Camada GraphQL (queries e mutations)
    ├── users.service.ts           # Regras de negócio e acesso a dados
    └── users.module.ts
```

## Decisões de design

- **Code-first.** O schema GraphQL é gerado a partir das classes TypeScript, então tipos e schema nunca ficam dessincronizados.
- **Entidade separada do tipo GraphQL.** `UserEntity` (banco) e `UserDto` (API) são classes distintas. Assim campos sensíveis, como a senha, não vazam por acidente para o schema.
- **Resolver fino, service com a lógica.** O resolver só traduz GraphQL em chamadas ao service, o que facilita testar a regra de negócio isolada.
- **Seguro por padrão.** O `JwtAuthGuard` é global: toda operação exige token, e só as marcadas com `@Public()` escapam. Esquecer de proteger uma rota nova não deixa um buraco.
- **JWT sem Passport.** Para um único fluxo com Bearer token, `@nestjs/jwt` com um guard próprio é menos código e menos indireção. O guard também confere se o usuário do token ainda existe.
- **Isolamento por dono na camada de serviço.** O `ownerId` nunca vem do cliente: o resolver o extrai do token e o service o aplica em toda consulta. Produto alheio responde como inexistente, e os testes e2e cobrem leitura, atualização e remoção entre dois usuários.
- **Estoque atômico.** `adjustStock` é um único `UPDATE ... WHERE quantity + :delta BETWEEN 0 AND :max`. A regra vive no banco, então não existe a janela entre "ler o saldo" e "gravar o novo" em que duas requisições passariam juntas. Os testes e2e disparam dezenas de ajustes em paralelo e conferem o saldo final.
- **Histórico como livro-razão.** Cada movimentação guarda a variação e o saldo resultante, e é gravada na mesma transação do `UPDATE` do estoque: ou os dois acontecem, ou nenhum. O `createdAt` usa `clock_timestamp()` (e não `now()`, que é o início da transação) para a ordem do histórico seguir a ordem real dos ajustes. Um teste e2e dispara 30 ajustes simultâneos e confere que a cadeia de saldos fecha.
- **Hash de senha com bcrypt.** A coluna `password` usa `select: false`, então ela nem é carregada nas consultas comuns.
- **UUID como chave primária.** Evita IDs previsíveis e colisões.
- **`synchronize: true` só para estudo.** É prático em desenvolvimento, mas em produção o caminho correto é usar migrations (item do roadmap).

## Roadmap

Ordem planejada de evolução:

1. **Testes.** ~~Unitários e e2e~~ (feito). Falta rodar tudo com cobertura no CI e cobrir resolvers e autorização.
2. **Migrations.** Trocar `synchronize` por migrations versionadas do TypeORM.
3. **Autenticação.** ~~JWT, guard global e `@CurrentUser()`~~ (feito). Falta refresh token e rate limit no login.
4. **Relações e N+1.** Entidade `Post` ligada a `User`, `@ResolveField` e DataLoader para agrupar consultas.
5. **Consultas avançadas.** Paginação (cursor ou offset), filtros e ordenação.
6. **Tempo real.** Subscriptions via WebSocket.
7. **Erros.** `formatError` customizado, códigos de erro consistentes e descrições nos `@Field` do schema.
8. **Qualidade e entrega.** Husky, lint-staged e commitlint; GitHub Actions rodando lint, testes e build; Dockerfile multi-stage; deploy com link público.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run start:dev` | Inicia a API com hot reload |
| `npm run build` | Compila o projeto para `dist/` |
| `npm run start:prod` | Executa a versão compilada |
| `npm run lint` | Roda o ESLint com correção automática |
| `npm run format` | Formata o código com Prettier |
| `npm test` | Testes unitários (mock do repositório) |
| `npm run test:cov` | Testes com relatório de cobertura |
| `npm run test:e2e` | Testes end-to-end contra o PostgreSQL de teste (requer `docker compose up -d`) |

## Licença

Projeto de estudo. Defina a licença no arquivo `LICENSE` antes de publicar.
