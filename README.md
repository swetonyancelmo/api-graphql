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
| Segurança | bcrypt (hash de senha) |
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
- [ ] Autenticação com JWT
- [ ] Segunda entidade (`Post`) com relação 1:N com `User`
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

### Erros esperados

- Email já cadastrado: `409 Conflict` com a mensagem *"Já existe um usuário com este email."*
- Dados inválidos (nome vazio, email malformado, senha com menos de 6 caracteres): `400 Bad Request` com as mensagens de validação.

## Estrutura de pastas

```text
src/
├── app.module.ts            # Módulo raiz: config, TypeORM e GraphQL
├── main.ts                  # Bootstrap e ValidationPipe global
├── schema.gql               # Schema gerado automaticamente
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
- **Hash de senha com bcrypt.** A coluna `password` usa `select: false`, então ela nem é carregada nas consultas comuns.
- **UUID como chave primária.** Evita IDs previsíveis e colisões.
- **`synchronize: true` só para estudo.** É prático em desenvolvimento, mas em produção o caminho correto é usar migrations (item do roadmap).

## Roadmap

Ordem planejada de evolução:

1. **Testes.** ~~Unitários e e2e~~ (feito). Falta rodar tudo com cobertura no CI e cobrir resolvers e autorização.
2. **Migrations.** Trocar `synchronize` por migrations versionadas do TypeORM.
3. **Autenticação.** JWT com `@nestjs/passport`, `AuthGuard` e decorator `@CurrentUser()` adaptado ao contexto GraphQL.
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
