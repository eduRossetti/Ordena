# Plano — Grupos, papéis, convites e tarefas (banco + backend)

Escopo: schema, migrations, models e rotas em `/api/v1`. Telas ficam para depois.
Branch: `feat/grupos-e-papeis`.

## Decisões (respondidas pelo usuário)

| Tema                        | Decisão                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Grupos por usuário          | **No máximo 1.** Conta nova nasce sem grupo e, portanto, sem papel.                                                             |
| Papel                       | Por vínculo (`group_members.role`): OWNER (criador), ADMIN, MEMBER. Quem sai e cria outro grupo vira OWNER só desse novo grupo. |
| Dono sai                    | Precisa **transferir a posse antes**. Se for o único membro, sair apaga o grupo.                                                |
| Convite a quem já tem grupo | Chega normalmente; **ao aceitar, sai do grupo atual** (se for OWNER com outros membros, precisa transferir antes).              |
| Quem convida                | Só OWNER e ADMIN. MEMBER não convida.                                                                                           |
| OWNER × ADMIN               | Diferem só em: OWNER promove/rebaixa ADMIN, remove ADMIN, transfere a posse e apaga o grupo.                                    |
| Tarefas                     | Qualquer membro cria e muda status; editar/apagar: autor, ADMIN ou OWNER.                                                       |

## O que muda em relação ao desenho atual (`docs/arquitetura.md`)

1. **`group_members.user_id` passa a ser `UNIQUE`** → garante no banco "1 grupo por usuário". A relação `User ↔ GroupMember` vira 1:1 (`user.membership`).
2. **Um único OWNER por grupo**: índice único parcial `group_members(group_id) WHERE role = 'OWNER'` (SQL manual, como o antigo `group_invites_pending_unique`).
3. **`groups.created_by_id` sai do desenho**: o "criador" é o OWNER em `group_members`. Com transferência de posse, guardar os dois seria duas fontes de verdade.
4. **`tasks.created_by_id` vira opcional** (`onDelete: SetNull`): a tarefa sobrevive à exclusão da conta do autor.
5. `users` não muda.

## Modelo de dados

```
User ─1:0..1─ GroupMember >─ Group ─┬─< Task ─< TaskAssignee >─ User
                (role)              └─< GroupInvite (invited_user, invited_by)
```

| Tabela           | Campos                                                                                                                                                | Restrições / índices                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `groups`         | id, name, description?, created_at, updated_at                                                                                                        | —                                                                                                                                 |
| `group_members`  | group_id, user_id, role (`GroupRole`), joined_at                                                                                                      | PK (group_id, user_id); **UNIQUE (user_id)**; único parcial (group_id) `WHERE role='OWNER'`; cascade ao apagar grupo ou usuário   |
| `group_invites`  | id, group_id, invited_user_id, invited_by_id?, status (`InviteStatus`), created_at, responded_at?                                                     | Único parcial (group_id, invited_user_id) `WHERE status='PENDING'`; índice (invited_user_id, status); `invited_by_id` com SetNull |
| `tasks`          | id, group_id, title, description?, status (`TaskStatus`), priority (`TaskPriority`), due_date?, created_by_id?, completed_at?, created_at, updated_at | Índice (group_id, status); cascade ao apagar grupo                                                                                |
| `task_assignees` | task_id, user_id, assigned_at                                                                                                                         | PK (task_id, user_id); cascade ao apagar tarefa ou usuário                                                                        |

Enums: `GroupRole` OWNER/ADMIN/MEMBER · `InviteStatus` PENDING/ACCEPTED/DECLINED/CANCELED · `TaskStatus` TODO/DOING/DONE · `TaskPriority` LOW/MEDIUM/HIGH.

Ids em UUID v7 (`@default(uuid(7)) @db.Uuid`), tabelas em snake_case.

## Matriz de permissões

| Ação                                     |                 OWNER                  | ADMIN |      MEMBER       | Sem grupo |
| ---------------------------------------- | :------------------------------------: | :---: | :---------------: | :-------: |
| Criar grupo                              |                   —                    |   —   |         —         |    ✅     |
| Ver grupo, membros e tarefas             |                   ✅                   |  ✅   |        ✅         |     —     |
| Editar nome/descrição do grupo           |                   ✅                   |  ✅   |         —         |     —     |
| Apagar grupo                             |                   ✅                   |   —   |         —         |     —     |
| Convidar / cancelar convite              |                   ✅                   |  ✅   |         —         |     —     |
| Remover MEMBER                           |                   ✅                   |  ✅   |         —         |     —     |
| Remover ADMIN · promover/rebaixar ADMIN  |                   ✅                   |   —   |         —         |     —     |
| Transferir posse                         |                   ✅                   |   —   |         —         |     —     |
| Sair do grupo                            | só após transferir (ou se for o único) |  ✅   |        ✅         |     —     |
| Criar tarefa · mudar status              |                   ✅                   |  ✅   |        ✅         |     —     |
| Editar/apagar tarefa (inclui atribuídos) |                   ✅                   |  ✅   | só se for o autor |     —     |

Não membro que acessa um grupo recebe 404 (não revela que o grupo existe). Membro sem papel suficiente recebe 403.

## Regras de negócio (no model, em transação quando mexem em mais de uma tabela)

- **Criar grupo**: falha com `ConflictError` se o usuário já tem grupo. Cria `groups` + `group_members` OWNER.
- **Sair / ser removido**: apaga o vínculo e os `task_assignees` desse usuário nas tarefas do grupo. Tarefas que ele criou ficam.
- **OWNER sai**: com outros membros → `ConflictError` ("transfira a posse antes"); sozinho → apaga o grupo (cascade).
- **Transferir posse**: alvo precisa ser membro; numa transação, o OWNER atual vira ADMIN e o alvo vira OWNER (rebaixa primeiro por causa do índice parcial).
- **Convidar**: por `username`; alvo inexistente → 404; já é membro deste grupo → 409; já tem convite pendente → 409 (violação do índice traduzida). Pode convidar quem tem outro grupo.
- **Aceitar convite**: só o convidado; convite precisa estar PENDING. Se já está em outro grupo, aplica a regra de "sair" antes (OWNER com outros membros → 409). Cria vínculo MEMBER e marca ACCEPTED. Recusar marca DECLINED; cancelar (OWNER/ADMIN) marca CANCELED.
- **Tarefa**: `assigneeIds` só aceita membros do grupo (senão 400). Ir para DONE preenche `completed_at`; sair de DONE limpa.

## Onde cada regra é aplicada

Quatro camadas, da última linha de defesa para a mais próxima do usuário:

| Camada                        | Onde                                          | Garante                                                                                                                                          |
| ----------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Banco**                     | `schema.prisma` + SQL manual na migration     | 1 grupo por usuário (UNIQUE `user_id`), 1 OWNER por grupo, 1 convite pendente por pessoa+grupo, cascades. Segura corrida entre duas requisições. |
| **Model** (onde a regra mora) | `src/models/group.js`, `invite.js`, `task.js` | Toda regra de negócio e permissão. Lança erros de `infra/errors`; traduz `P2002` (violação de único) em `ConflictError` com mensagem própria.    |
| **Controller**                | `route.js`                                    | Só `controller.authenticate`, lê params/body e repassa `ctx.user`. **Nenhum `if` de papel aqui.**                                                |
| **Tela**                      | `(app)/` + `src/lib/validation/`              | Esconde botões conforme `membership.role` do `GET /user` (conforto, não segurança) e mostra `message`/`action` do erro. A API decide.            |

### Helpers de permissão (em `src/models/group.js`, exportados para `invite` e `task`)

- `findMembership(user, groupId)` → devolve o vínculo `{ groupId, userId, role }` ou lança `NotFoundError` ("Grupo não encontrado.") se não for membro. **Toda** função de grupo/convite/tarefa começa por ele.
- `assertRole(membership, roles)` → lança `ForbiddenError` se `membership.role` não está em `roles`.
- Regras que leem e escrevem (sair, transferir, aceitar convite) rodam em `prisma.$transaction`, relendo o vínculo dentro dela.

### Respostas por regra

Corpo de erro sempre `{ name, message, action, statusCode }`; sucesso devolve o recurso direto.

| Situação                                                        | Função do model               | Status | `message` / `action`                                                                         |
| --------------------------------------------------------------- | ----------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| OWNER sai com outros membros (`DELETE /groups/:id/members/:eu`) | `group.removeMember`          | 409    | "Você é o dono deste grupo." / "Transfira a posse para outro membro antes de sair."          |
| OWNER sai sendo o único membro                                  | `group.removeMember`          | 204    | — (grupo apagado; `GET /user` passa a trazer `membership: null`)                             |
| ADMIN/MEMBER sai                                                | `group.removeMember`          | 204    | —                                                                                            |
| Criar grupo já tendo um (`POST /groups`)                        | `group.create`                | 409    | "Você já participa de um grupo." / "Saia do grupo atual para criar outro."                   |
| Não membro acessa `/groups/:id/**`                              | `findMembership`              | 404    | "Grupo não encontrado." / "Verifique se você ainda participa deste grupo."                   |
| MEMBER convida, edita grupo ou remove alguém                    | `assertRole`                  | 403    | "Apenas o dono e os administradores podem fazer isso." / "Peça a um administrador do grupo." |
| ADMIN promove/rebaixa ou remove ADMIN, transfere ou apaga grupo | `assertRole`                  | 403    | "Apenas o dono do grupo pode fazer isso." / "Peça ao dono do grupo."                         |
| Alguém tenta mudar o papel do OWNER via `PATCH members`         | `group.updateMemberRole`      | 400    | "A posse só muda por transferência." / "Use a transferência de posse."                       |
| Transferir para quem não é membro                               | `group.transferOwnership`     | 404    | "Membro não encontrado."                                                                     |
| Convidar `username` inexistente                                 | `invite.create`               | 404    | "Usuário não encontrado." / "Confira o username."                                            |
| Convidar quem já é deste grupo · já tem convite pendente        | `invite.create`               | 409    | "Esta pessoa já participa do grupo." · "Já existe um convite pendente para esta pessoa."     |
| Aceitar sendo OWNER de outro grupo com membros                  | `invite.respond`              | 409    | Mesma mensagem do OWNER saindo (o front mostra igual)                                        |
| Aceitar/recusar convite que não é seu                           | `invite.respond`              | 404    | "Convite não encontrado." (não revela convites de terceiros)                                 |
| Responder convite que não está PENDING                          | `invite.respond`              | 409    | "Este convite já foi respondido ou cancelado."                                               |
| Aceitar convite com sucesso                                     | `invite.respond`              | 200    | Convite atualizado + `membership` novo                                                       |
| MEMBER edita/apaga tarefa de outro autor                        | `task.update` / `task.remove` | 403    | "Você só pode editar as tarefas que criou." (mudar só `status` é liberado)                   |
| `assigneeIds` com quem não é membro                             | `task.create` / `task.update` | 400    | "Só é possível atribuir tarefas a membros do grupo."                                         |

O front diferencia os casos pelo `statusCode` + rota chamada e exibe `message`/`action` como vêm; não precisa de código de erro novo.

### Testes que provam cada regra

Cada linha da tabela acima vira pelo menos um caso no teste de integração do método correspondente (`tests/integration/api/v1/groups/[groupId]/members/[userId]/delete.test.js` etc.), conferindo status **e** corpo. Para as garantias do banco, um teste que tenta inserir direto pelo Prisma (via `orchestrator`) e espera a violação.

## Rotas (`/api/v1`)

| Rota                                   | Métodos            | Para quê                                                           |
| -------------------------------------- | ------------------ | ------------------------------------------------------------------ |
| `/user`                                | GET                | Passa a incluir `membership: { groupId, groupName, role } \| null` |
| `/groups`                              | POST               | Criar grupo                                                        |
| `/groups/[groupId]`                    | GET, PATCH, DELETE | Ver, editar, apagar                                                |
| `/groups/[groupId]/members`            | GET                | Listar membros com papel                                           |
| `/groups/[groupId]/members/[userId]`   | PATCH, DELETE      | Mudar papel · remover (ou sair, quando `userId` é o próprio)       |
| `/groups/[groupId]/ownership`          | PUT                | Transferir posse (`{ userId }`)                                    |
| `/groups/[groupId]/invites`            | GET, POST          | Convites pendentes do grupo · convidar (`{ username }`)            |
| `/groups/[groupId]/invites/[inviteId]` | DELETE             | Cancelar convite                                                   |
| `/user/invites`                        | GET                | Meus convites pendentes                                            |
| `/invites/[inviteId]`                  | PATCH              | Aceitar/recusar (`{ status: 'ACCEPTED' \| 'DECLINED' }`)           |
| `/groups/[groupId]/tasks`              | GET, POST          | Listar (filtro `?status=`) · criar                                 |
| `/groups/[groupId]/tasks/[taskId]`     | GET, PATCH, DELETE | Ver · editar/mudar status · apagar                                 |

## Fatias de entrega (cada uma com migration própria, TDD e docs)

1. **Grupos e membros** — enum `GroupRole`, `groups`, `group_members` (+ índices manuais), `src/models/group.js`, rotas de grupo/membros/posse, `membership` em `GET /user`.
2. **Convites** — enum `InviteStatus`, `group_invites` (+ índice parcial), `src/models/invite.js`, rotas de convite.
3. **Tarefas** — enums `TaskStatus`/`TaskPriority`, `tasks`, `task_assignees`, `src/models/task.js`, rotas de tarefa.

Cada fatia: teste de integração falhando primeiro (um arquivo por método), depois model e rota; `tests/orchestrator.js` ganha helpers (`createGroup`, `addMember`, `createInvite`, `createTask`). Ao final de cada uma, atualizar `docs/arquitetura.md` (sai de "Planejado") e o trecho de domínio do `AGENTS.md`. Só migrations aditivas, então a regra de duas etapas não se aplica.

## Fora do escopo

Telas, notificações, histórico/auditoria de tarefas, comentários, limite de membros por grupo.
