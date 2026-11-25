---
name: alterar-banco
description: Altera o schema do banco do Ordena (Prisma + PostgreSQL), cria a migration e atualiza models, testes e docs afetados. Use ao criar/alterar tabelas, campos, enums ou índices.
---

# Alterar o banco

Schema: `infra/prisma/schema.prisma`. Migrations: `infra/prisma/migrations/` (versionadas). Config: `prisma.config.js`.

## Passos

1. `npm run db:up` (Postgres no ar).
2. Edite `infra/prisma/schema.prisma`:
   - IDs `String @id @default(uuid(7)) @db.Uuid` e FKs com `@db.Uuid`; datas `createdAt`/`updatedAt` com `@map("created_at")` etc.
   - Tabela em snake_case plural via `@@map`; campos camelCase com `@map` para snake_case.
   - Relações com `onDelete` explícito quando fizer sentido (ex.: `Cascade` em tabelas filhas).
   - Índices para os filtros reais (`@@index`). Unicidade no banco, não só no model. O que o Prisma não expressa (ex.: índice único parcial) vai em SQL manual na migration (`--create-only`, edite, depois aplique); confira com `npm run db:migrate` que não gera drift.
3. `npm run db:migrate -- --name <verbo_objeto>` (ex.: `add_task_labels`). Confira o SQL gerado antes de commitar.
4. Atualize os **models** afetados em `src/models/` e as rotas (`route.js`) e testes que dependem deles.
5. Banco de teste: o `npm test` aplica as migrations sozinho (`tests/integration/global-setup.js`).
6. Atualize `docs/arquitetura.md` (seção do schema) se o modelo de dados mudou.
7. `npm test && npm run lint`.

## Regras

- **Nunca** edite uma migration já aplicada/commitada; crie outra.
- Mudança destrutiva (drop/rename de coluna com dados): faça em duas migrations ou escreva SQL manual revisado.
- `npm run db:generate` regenera o client (`infra/prisma/generated`, ignorado pelo git; roda no `postinstall`).
- Senhas só como `passwordHash` (bcrypt); nunca selecionar esse campo em respostas.
