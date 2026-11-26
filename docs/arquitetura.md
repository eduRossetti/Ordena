# Arquitetura do Ordena

## Visão geral

PWA mobile-first em Next.js com interface construída sobre o GitHub Primer (`@primer/react`, tema escuro fixo) e CSS Modules com tokens do `@primer/primitives`. O navegador instala o app na tela inicial (`src/app/manifest.js`, `display: standalone`). O front consome **somente** a API REST interna.

```
Navegador (React)  ──fetch──▶  /api/v1/**/route.js  (controller: next-connect, lê entrada, responde)
                                   │
                                   ▼
                             src/models/<recurso>.js  (regras, permissões, validação Zod, Prisma)
                                   │
                                   ▼
                               PostgreSQL
```

Fat model, thin controller, inspirado no clone-tabnews: o controller só traduz HTTP; toda regra mora no model.

No navegador, as telas chamam a API por `apiFetch` (`src/lib/api.js`), que nunca lança e devolve `{ ok, status, data | error }`. Formulários validam antes de enviar com as regras dos models espelhadas em `src/lib/validation/`; a API continua sendo a palavra final.

Transversal em `infra/`: `controller.js` (`errorHandlers` do next-connect: erro padrão e 405), `errors.js` (erros públicos), `database.js` (Prisma singleton com adapter `pg`), `prisma/` (schema + migrations), `compose.yaml` + `database/init.sql` (Postgres de dev com `ordena_dev` e `ordena_test`).

## Contrato da API

- `/api/v1/...`; sucesso devolve o recurso direto (200/201, 204 sem corpo).
- Erro: `{ name, message, action, statusCode }`.

| `name`                  | Status | Quando                                        |
| ----------------------- | ------ | --------------------------------------------- |
| `ValidationError`       | 400    | Entrada inválida (inclui `ZodError`)          |
| `UnauthorizedError`     | 401    | Sem sessão válida                             |
| `ForbiddenError`        | 403    | Sem permissão (ex.: não é membro do grupo)    |
| `NotFoundError`         | 404    | Recurso inexistente                           |
| `MethodNotAllowedError` | 405    | Método HTTP não registrado na rota            |
| `ConflictError`         | 409    | Conflito de estado (ex.: username já em uso)  |
| `InternalServerError`   | 500    | Qualquer erro inesperado (logado no servidor) |

## Modelo de dados

Hoje o schema tem só o que já tem código por trás. O resto entra, com migration própria, junto com a feature que o usa.

```
User ─< Session
```

| Tabela     | Campos principais                                                          | Observações                                                                                                                                 |
| ---------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`    | id, username (único), name, email (único), password_hash                   | Convite será feito pelo `username`                                                                                                          |
| `sessions` | id, user_id, token_hash (único, sha256 do refresh), expires_at, revoked_at | Uma linha por login/aparelho; refresh rotaciona (revoga a linha e cria outra); reuso de refresh revogado revoga todas as sessões do usuário |

### Planejado (ainda sem tabela)

Removido na migration `drop_unused_tables`; recriar com a feature correspondente, seguindo este desenho:

```
User ─┬─< GroupMember >─┬─ Group ─┬─< Task ─< TaskAssignee >─ User
      │                 │         └─< GroupInvite
      └─ (createdBy)    └─ role: OWNER | ADMIN | MEMBER
```

| Tabela           | Campos principais                                                                         | Observações                                                                                                                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `groups`         | id, name, description, created_by_id                                                      | Criador vira `OWNER` em `group_members`                                                                                                                                                                                        |
| `group_members`  | group_id + user_id (PK), role, joined_at                                                  | Base de todas as checagens de permissão                                                                                                                                                                                        |
| `group_invites`  | id, group_id, invited_user_id, invited_by_id, status, responded_at                        | Status PENDING/ACCEPTED/DECLINED/CANCELED; 1 pendente por pessoa+grupo (índice único parcial `WHERE status = 'PENDING'`, migration SQL manual; o model traduz a violação em `ConflictError`); índice (invited_user_id, status) |
| `tasks`          | id, group_id, title, description, status, priority, due_date, created_by_id, completed_at | Status TODO/DOING/DONE; prioridade LOW/MEDIUM/HIGH; índice (group_id, status)                                                                                                                                                  |
| `task_assignees` | task_id + user_id (PK), assigned_at                                                       | N:N: várias pessoas por tarefa                                                                                                                                                                                                 |

Também adiado: `users.avatar_url` (volta com o upload de avatar).

> Todos os ids (PKs e FKs) são `UUID` nativo do Postgres, gerados como UUID v7 (`@default(uuid(7)) @db.Uuid`).

## Fluxos principais (a implementar)

- **Convite**: membro (OWNER/ADMIN) busca usuário por `username` → cria `GroupInvite` PENDING → convidado vê convites pendentes dentro do app → aceita (cria `GroupMember`, marca ACCEPTED) ou recusa.
- **Tarefa**: membro cria tarefa no grupo, atribui a membros (`TaskAssignee`), muda status; `completed_at` preenchido ao ir para DONE.
- **Auth**: e-mail + senha → JWT de acesso (15 min, cookie httpOnly) + refresh token opaco (30 dias, hash em `sessions`, rotação a cada uso). `controller.authenticate` valida o JWT e põe `ctx.user`; o controller repassa o usuário como **primeiro argumento** do model (`task.create(user, groupId, input)`), que decide a permissão.

## Fora do escopo da base atual

Logout, autorização por rota/grupo na tela (o proxy só checa se há sessão), CRUDs de grupo/tarefa/convite e suas telas, service worker (offline/cache). CI e deploy já existem: veja `docs/deploy.md`.

## Decisões

- **Auth com JWT (`jose`)**: payload só de identidade; papéis ficam no banco porque são por grupo e mudam. Access curto + refresh em tabela permite logout e revogação reais. Cookies httpOnly (mesma origem do PWA).
- Next.js App Router; cada `route.js` é o controller, com **next-connect** para organizar handlers e middlewares.
- Fat model, sem camada de service; respostas sem envelope e erros com `action` (padrões do clone-tabnews).
- JavaScript puro (sem TypeScript).
- Front lê e escreve tudo pela API (uma única porta de entrada, mais fácil de testar e de evoluir para cliente nativo).
- Prisma 7 com driver adapter `pg`; client gerado em `infra/prisma/generated` (não versionado).
