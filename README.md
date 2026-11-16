# Estudos GraphQL

[![CI](https://github.com/swetonyancelmo/api-graphql/actions/workflows/ci.yml/badge.svg)](https://github.com/swetonyancelmo/api-graphql/actions/workflows/ci.yml)
![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)
![GraphQL](https://img.shields.io/badge/GraphQL-16-E10098?logo=graphql&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)

API GraphQL para **cadastro de produtos e controle de estoque**. Cada usuário se cadastra, faz login e gerencia apenas os próprios produtos, registrando entradas e saídas de estoque com histórico completo.

## Funcionalidades

- **Autenticação com JWT:** cadastro e login, com senha armazenada em hash (bcrypt).
- **Produtos por usuário:** cada usuário só enxerga e altera os seus próprios produtos.
- **Estoque seguro:** o ajuste é atômico, então o saldo nunca fica negativo, mesmo com várias requisições simultâneas.
- **Histórico de movimentações:** cada entrada e saída é registrada com saldo resultante e motivo.
- **Erros padronizados:** códigos estáveis e validação detalhada, sem expor detalhes internos.

## Tecnologias

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

## Como rodar

Requisitos: Node.js 24 e Docker.

```bash
npm install
cp .env.example .env
docker compose up -d        # sobe o PostgreSQL
npm run migration:run       # cria as tabelas
npm run start:dev           # inicia a API
```

Abra **http://localhost:3000/graphql** para explorar o schema e testar as operações no Apollo Sandbox.

## Exemplo de uso

```graphql
# 1. Criar um usuário
mutation {
  createUser(input: { name: "Ana", email: "ana@exemplo.com", password: "segredo123" }) {
    id
  }
}

# 2. Fazer login e copiar o token
mutation {
  login(input: { email: "ana@exemplo.com", password: "segredo123" }) {
    accessToken
  }
}
```

Nas demais requisições, envie o header `Authorization: Bearer <accessToken>`:

```graphql
# 3. Criar um produto com estoque inicial (preço em centavos)
mutation {
  createProduct(
    input: { name: "Teclado", description: "Mecânico", quantity: 10, unitPriceCents: 19990 }
  ) {
    id
    quantity
  }
}

# 4. Registrar uma saída de 3 unidades
mutation {
  adjustStock(id: "ID_DO_PRODUTO", input: { delta: -3, reason: "Venda" }) {
    quantity
  }
}

# 5. Consultar o histórico do produto
query {
  stockMovements(productId: "ID_DO_PRODUTO") {
    delta
    quantityAfter
    reason
    createdAt
  }
}
```

## Testes

```bash
npm test             # testes unitários
npm run test:e2e     # testes end-to-end (requer o PostgreSQL rodando)
```

Os testes e o lint rodam automaticamente a cada push pelo GitHub Actions.
