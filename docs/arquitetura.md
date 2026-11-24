# Arquitetura do Ordena

## Visão geral

PWA mobile-first em Next.js. O navegador instala o app na tela inicial (`src/app/manifest.js`, `display: standalone`). O front consome **somente** a API REST interna.

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

```
User ─┬─< GroupMember >─┬─ Group ─┬─< Task ─< TaskAssignee >─ User
      │                 │         └─< GroupInvite
      └─ (createdBy)    └─ role: OWNER | ADMIN | MEMBER
```

| Tabela           | Campos principais                                                                         | Observações                                                                                                                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `users`          | id, username (único), name, email (único), password_hash, avatar_url                      | Convite é feito pelo `username`                                                                                                                                                                                                |
| `groups`         | id, name, description, created_by_id                                                      | Criador vira `OWNER` em `group_members`                                                                                                                                                                                        |
| `group_members`  | group_id + user_id (PK), role, joined_at                                                  | Base de todas as checagens de permissão                                                                                                                                                                                        |
| `group_invites`  | id, group_id, invited_user_id, invited_by_id, status, responded_at                        | Status PENDING/ACCEPTED/DECLINED/CANCELED; 1 pendente por pessoa+grupo (índice único parcial `WHERE status = 'PENDING'`, migration SQL manual; o model traduz a violação em `ConflictError`); índice (invited_user_id, status) |
| `tasks`          | id, group_id, title, description, status, priority, due_date, created_by_id, completed_at | Status TODO/DOING/DONE; prioridade LOW/MEDIUM/HIGH; índice (group_id, status)                                                                                                                                                  |
| `task_assignees` | task_id + user_id (PK), assigned_at                                                       | N:N: várias pessoas por tarefa                                                                                                                                                                                                 |

> Todos os ids (PKs e FKs) são `UUID` nativo do Postgres, gerados como UUID v7 (`@default(uuid(7)) @db.Uuid`).

## Fluxos principais (a implementar)

- **Convite**: membro (OWNER/ADMIN) busca usuário por `username` → cria `GroupInvite` PENDING → convidado vê convites pendentes dentro do app → aceita (cria `GroupMember`, marca ACCEPTED) ou recusa.
- **Tarefa**: membro cria tarefa no grupo, atribui a membros (`TaskAssignee`), muda status; `completed_at` preenchido ao ir para DONE.
- **Auth**: e-mail + senha (Auth.js Credentials). Sessão identifica o usuário nas rotas; o controller repassa o usuário como **primeiro argumento** do model (`task.create(user, groupId, input)`), que decide a permissão.

## Fora do escopo da base atual

Autenticação, CRUDs de grupo/tarefa/convite, telas, service worker (offline/cache), CI e deploy.

## Decisões

- Next.js App Router; cada `route.js` é o controller, com **next-connect** para organizar handlers e middlewares.
- Fat model, sem camada de service; respostas sem envelope e erros com `action` (padrões do clone-tabnews).
- JavaScript puro (sem TypeScript).
- Front lê e escreve tudo pela API (uma única porta de entrada, mais fácil de testar e de evoluir para cliente nativo).
- Prisma 7 com driver adapter `pg`; client gerado em `infra/prisma/generated` (não versionado).
