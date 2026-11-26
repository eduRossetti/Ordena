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

```
User ─┬─< Session
      └─1:0..1─ GroupMember >─ Group ─┬─< Task ─< TaskAssignee >─ User
                  (role)              └─< GroupInvite (invited_user, invited_by)
```

| Tabela           | Campos principais                                                                          | Observações                                                                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`          | id, username (único), name, email (único), password_hash                                   | Convite feito pelo `username`; `avatar_url` adiado até o upload de avatar                                                                                                                                                          |
| `sessions`       | id, user_id, token_hash (único, sha256 do refresh), expires_at, revoked_at                 | Uma linha por login/aparelho; refresh rotaciona (revoga a linha e cria outra); reuso de refresh revogado revoga todas as sessões do usuário                                                                                        |
| `groups`         | id, name, description, created_at, updated_at                                              | O dono é representado pelo vínculo `OWNER` em `group_members`                                                                                                                                                                      |
| `group_members`  | group_id + user_id (PK), role (`GroupRole`), joined_at                                     | `UNIQUE (user_id)` garante 1 grupo por usuário; índice único parcial `(group_id) WHERE role = 'OWNER'` garante 1 dono por grupo; base de todas as checagens de permissão                                                           |
| `group_invites`  | id, group_id, invited_user_id, invited_by_id?, status (`InviteStatus`), responded_at       | Status PENDING/ACCEPTED/DECLINED/CANCELED; índice único parcial `(group_id, invited_user_id) WHERE status = 'PENDING'` (traduzido em `ConflictError`); índice `(invited_user_id, status)`; `invited_by_id` com `onDelete: SetNull` |
| `tasks`          | id, group_id, title, description, status, priority, due_date, created_by_id?, completed_at | Status TODO/DOING/DONE; prioridade LOW/MEDIUM/HIGH; índice `(group_id, status)`; `created_by_id` opcional com `onDelete: SetNull` (tarefa sobrevive à exclusão do autor)                                                           |
| `task_assignees` | task_id + user_id (PK), assigned_at                                                        | N:N: várias pessoas por tarefa; cascade ao apagar tarefa ou usuário; limpo para o grupo quando o membro sai ou é removido                                                                                                          |

> Todos os ids (PKs e FKs) são `UUID` nativo do Postgres, gerados como UUID v7 (`@default(uuid(7)) @db.Uuid`).

## Fluxos principais

- **Grupos e papéis**: cada usuário participa de no máximo 1 grupo (`GET /user` inclui `membership: { groupId, groupName, role } | null`). Criar grupo coloca o criador como `OWNER`. `OWNER` pode promover/rebaixar `ADMIN`, remover `ADMIN`, transferir a posse (`PUT /groups/[groupId]/ownership`, que rebaixa o antigo dono a `ADMIN`) e apagar o grupo. Para sair, o `OWNER` precisa transferir a posse antes — exceto se for o único membro, caso em que sair apaga o grupo. Não membro recebe 404 (não revela a existência do grupo).
- **Convite**: `OWNER`/`ADMIN` convida por `username` (`POST /groups/[groupId]/invites`) → cria `GroupInvite` `PENDING` → convidado vê convites em `GET /user/invites` → aceita ou recusa em `PATCH /invites/[inviteId]`. Aceitar sai automaticamente do grupo anterior (aplicando a regra de saída do `OWNER`) e cria vínculo `MEMBER`.
- **Tarefa**: qualquer membro cria (`POST /groups/[groupId]/tasks`) e muda o status; editar outros campos (incluindo `assigneeIds`, restritos a membros do grupo) ou apagar exige ser autor, `ADMIN` ou `OWNER`. Ir para `DONE` preenche `completed_at`; sair de `DONE` limpa.
- **Auth**: e-mail + senha → JWT de acesso (15 min, cookie httpOnly) + refresh token opaco (30 dias, hash em `sessions`, rotação a cada uso). `controller.authenticate` valida o JWT e põe `ctx.user`; o controller repassa o usuário como **primeiro argumento** do model (`task.create(user, groupId, input)`), que decide a permissão.

## Fora do escopo da base atual

Telas de grupos, convites e tarefas, logout na interface, autorização por rota/grupo na tela (o proxy só checa se há sessão), service worker (offline/cache), notificações, comentários e histórico/auditoria de tarefas. CI e deploy já existem: veja `docs/deploy.md`.

## Decisões

- **Auth com JWT (`jose`)**: payload só de identidade; papéis ficam no banco porque são por grupo e mudam. Access curto + refresh em tabela permite logout e revogação reais. Cookies httpOnly (mesma origem do PWA).
- Next.js App Router; cada `route.js` é o controller, com **next-connect** para organizar handlers e middlewares.
- Fat model, sem camada de service; respostas sem envelope e erros com `action` (padrões do clone-tabnews).
- JavaScript puro (sem TypeScript).
- Front lê e escreve tudo pela API (uma única porta de entrada, mais fácil de testar e de evoluir para cliente nativo).
- Prisma 7 com driver adapter `pg`; client gerado em `infra/prisma/generated` (não versionado).
