# Ordena — guia para agentes

App de tarefas **compartilhadas em grupo**, usado como PWA no celular (instalado pelo navegador).
Usuários criam grupos, convidam pessoas pelo **username** (único) e atribuem tarefas a uma ou várias pessoas.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Stack

Next.js (App Router) · JavaScript (sem TypeScript) · React · GitHub Primer (`@primer/react`) · Prisma 7 + PostgreSQL · next-connect · Zod · Jest · ESLint · Prettier.
Textos de interface em **pt-BR**; código, rotas e nomes em **inglês**.

## Comandos

| Comando                                       | Para quê                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `npm run db:up` / `db:down`                   | Sobe/derruba o Postgres (Docker)                                                           |
| `npm run db:migrate -- --name <nome>`         | Cria e aplica migration (dev)                                                              |
| `npm run db:generate` / `db:studio`           | Gera o client Prisma / abre o Studio                                                       |
| `npm run dev`                                 | Sobe o banco, aplica migrations e abre http://localhost:3000                               |
| `npm test` · `test:unit` · `test:integration` | Jest (integration usa o banco `ordena_test`, aplica as migrations sozinho e roda em série) |
| `npm run lint` · `format:check`               | ESLint · Prettier (`format` corrige)                                                       |

Primeiro uso: `cp .env.example .env && npm install && npm run dev`.
Se `ordena_test` não existir (volume antigo, o `init.sql` só roda na criação): `npm run db:down -- -v && npm run db:up`.

## Arquitetura (MVC, fat model · thin controller)

Inspirada no [clone-tabnews](https://github.com/filipedeschamps/clone-tabnews), adaptada ao App Router e ao Prisma.

```
src/app/api/v1/**/route.js (controller)  →  src/models/<recurso>.js (model)  →  Prisma
```

| Camada     | Pasta                               | Faz                                                                                             | NÃO faz                   |
| ---------- | ----------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------- |
| Controller | `src/app/api/v1/**/route.js`        | Router next-connect: lê entrada (body, params, query), chama o model, responde o recurso        | Regra de negócio, Prisma  |
| Model      | `src/models/<recurso>.js`           | Regras de negócio, permissões, validação (Zod) e acesso ao banco. Lança erros de `infra/errors` | Conhecer Request/Response |
| View       | `src/app/(...)/`, `src/components/` | React mobile-first; **lê e escreve tudo via API** (`fetch` em `/api/v1`)                        | Importar models/Prisma    |

No front, `src/lib/` guarda o que não é componente: `api.js` (`apiFetch`, cliente da API para o navegador) e `validation/` (regras dos models espelhadas para validar o formulário antes de enviar; mudou a regra no model, mude lá também).

`infra/` guarda o que é transversal: `controller.js` (`errorHandlers`: `onError` e `onNoMatch`), `errors.js` (erros públicos), `token.js` (JWT e refresh token, sem banco), `database.js` (Prisma singleton), `prisma/` (schema + migrations), `compose.yaml` (Postgres).
O ESLint **bloqueia** importar `infra/database` (e o client Prisma) em `.js`/`.jsx` de `src/` fora de `src/models/`. Os testes (`tests/`) ficam fora dessa regra de propósito: helpers como `tests/orchestrator.js` podem usar o Prisma para semear e limpar dados, mas o código de produção não.

### Padrão de controller (`route.js`)

```js
import { createEdgeRouter } from 'next-connect';
import controller from 'infra/controller';
import task from '@/models/task';

const router = createEdgeRouter();
router.get(controller.authenticate, getHandler);
router.post(controller.authenticate, postHandler);

// Exporte todos os métodos: os não registrados caem no onNoMatch (405).
const handler = router.handler(controller.errorHandlers);
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };

// `ctx.user` = usuário autenticado, posto por `controller.authenticate` (veja "Usuário autenticado").
async function getHandler(request, ctx) {
  const { groupId } = await ctx.params;
  return Response.json(await task.findAllByGroupId(ctx.user, groupId), { status: 200 });
}

async function postHandler(request, ctx) {
  const { groupId } = await ctx.params;
  const newTask = await task.create(ctx.user, groupId, await controller.readJson(request));
  return Response.json(newTask, { status: 201 });
}
```

### Usuário autenticado

Todo model que depende de quem chama recebe o **usuário como primeiro argumento** (`task.create(user, groupId, input)`) e faz a checagem de membro/papel com ele. O controller só obtém o usuário e repassa; nunca decide permissão.

Autenticação (JWT com `jose`, só backend por enquanto):

- **Access token**: JWT HS256 de 15 min no cookie `access_token` (httpOnly, `SameSite=Lax`, `Secure` em produção). Payload só de identidade (`sub`, `username`, `name`, `sid`, `iss`, `aud`); **nunca** senha, e-mail ou papéis. Papel de grupo muda a qualquer hora, então o model confere no banco (`group_members`).
- **Refresh token**: string opaca de 30 dias no cookie `refresh_token` (`Path=/api/v1/sessions`); o banco guarda só o hash sha256 (`sessions`). Cada uso rotaciona; reapresentar um já usado revoga todas as sessões do usuário.
- Rota protegida: `router.get(controller.authenticate, handler)`. O middleware põe `ctx.user` (`{ id, username, name, sessionId }`) ou lança `UnauthorizedError`. Aplique por método (não com `router.use`) para que métodos não registrados continuem devolvendo 405.
- Corpo JSON: use `controller.readJson(request)` (JSON inválido vira 400, não 500).
- `JWT_SECRET` (mín. 32 caracteres) vem do `.env`. Rotas: `POST /users` (cadastro), `POST|DELETE /sessions` (login, logout), `POST /sessions/refresh`, `GET /user` (usuário atual).
- Em testes, use `orchestrator.createUser()` e `orchestrator.createSession(user)` (devolve a string `cookie`).

### Padrão de model

Funções no arquivo e um objeto como `export default` (`task.create`, `task.findOneById`). Schemas Zod ficam no próprio model e são aplicados no início de `create`/`update` (`schema.parse(input)`). Nunca devolva `passwordHash`: selecione só os campos públicos.

Referência viva: `/api/v1/status` (`src/app/api/v1/status/route.js` → `src/models/status.js` + `tests/integration/api/v1/status/`).

### Contrato da API

- Prefixo `/api/v1`. Sucesso: o **recurso direto** no corpo (sem envelope), com status 200/201 (204 sem corpo).
- Erro: `{ "name", "message", "action", "statusCode" }`. `message` diz o que houve e `action` diz o que o usuário deve fazer (pt-BR).
- Models lançam `ValidationError` 400, `UnauthorizedError` 401, `ForbiddenError` 403, `NotFoundError` 404, `ConflictError` 409. `ZodError` vira `ValidationError`; método não registrado vira `MethodNotAllowedError` 405; qualquer outro erro vira `InternalServerError` 500.
- Toda rota de grupo/tarefa deve checar que o usuário autenticado é **membro** do grupo (no model, usando o `user` recebido).
- `message` de erro de validação em pt-BR: passe mensagens explícitas nos schemas Zod (o fallback do Zod é pt-PT).

## CI e deploy

A `main` é protegida: só entra por PR com os checks do CI (`Lint e formatação`, `Testes (Jest)`, `Build (Next.js)`) verdes. A Vercel faz o deploy (push na `main` = Production, outras branches/PRs = Preview, cada um com o seu banco) e roda as migrations no build (`vercel-build`). Migration que remove/renomeia coluna ou tabela segue a regra de duas etapas da skill `alterar-banco`. Fluxo completo, segredos e limites: `docs/deploy.md`.

## Domínio

User (`username` único) · Group · GroupMember (role OWNER/ADMIN/MEMBER) · GroupInvite (convite por username: PENDING/ACCEPTED/DECLINED/CANCELED) · Task (TODO/DOING/DONE, prioridade) · TaskAssignee (N:N, várias pessoas por tarefa).
Schema em `infra/prisma/schema.prisma`; detalhes em `docs/arquitetura.md`.
**Hoje o schema só tem `User` e `Session`**; Group, GroupMember, GroupInvite, Task e TaskAssignee estão planejados (desenho em `docs/arquitetura.md`) e entram, com migration própria, junto com a feature que os usa.
Login por e-mail + senha (`bcryptjs`) com JWT (`jose`) e refresh token em `sessions` (ver "Usuário autenticado"). Telas: `/signup` e `/login` em `(auth)`; a home `/` é a área logada provisória em `(app)`. `src/proxy.js` (proxy do Next, antigo middleware) protege toda tela, exceto `/login`, `/signup` e `/refresh` (APIs, `_next` e assets ficam fora; `/api/v1` responde 401 sozinha). Sem JWT de acesso válido, redireciona para `/refresh?next=<tela>`, que renova a sessão com o refresh token (só ali o navegador o envia, por causa do `Path=/api/v1/sessions`) e volta à tela; se falhar, vai para `/login`. Tela nova já nasce protegida; para abri-la a deslogados, inclua o caminho em `PUBLIC_PATHS`. O refresh também é automático nas chamadas de API: `apiFetch` renova e repete uma vez ao receber 401 (veja `src/lib/api.js`).

## Convenções

- Arquivos: models em `src/models/<recurso>.js` (singular, `export default`); testes de integração em `tests/integration/api/v1/<rota>/<metodo>.test.js` (`get.test.js`, `post.test.js`).
- Extensões: arquivos com JSX são `.jsx` (componentes, `page.jsx`, `layout.jsx`); o resto é `.js` (`route.js`, models, hooks, lib).
- Imports: `@/…` para `src/`, `infra/…` para `infra/`.
- Formatação: Prettier (aspas simples, 100 colunas). Não discuta estilo, rode `npm run format`.
- Rotas de tela usam grupos `(app)` (área logada) e `(auth)` (login/cadastro).
- Tabelas em snake_case via `@map`/`@@map`; campos em camelCase no Prisma.
- Testes: integration chamando o handler exportado pelo `route.js` com o banco de teste; unit só para lógica pura de model.

## Definição de pronto

1. `npm test`, `npm run lint` e `npm run format:check` passam.
2. Mudou o schema → migration criada e commitada (nunca editar migration já aplicada). Se ela remove/renomeia algo, está dividida em duas etapas (skill `alterar-banco`).
3. Endpoint novo → um teste de integração por método e segue o padrão controller → model.
4. Sem segredos no git (`.env` é local; só `.env.example` é versionado).

## Skills (`.agents/skills/`)

Fonte única das skills: `.agents/skills/` (lida por Codex e Antigravity). `.claude/skills` é um link simbólico para ela (Claude Code).

> **Regra para qualquer IA:** crie, edite e apague skills **somente em `.agents/skills/`**. Nunca escreva em `.claude/skills/` (é o mesmo diretório por link; criar lá confunde e pode quebrar o link). Não copie skills para outras pastas (`.cursor/`, `.codex/`, etc.).

Hoje só existem skills próprias do Ordena (inventário em `docs/skills.md`):

- `criar-endpoint` — fatia completa model → `route.js` (controller) + testes.
- `alterar-banco` — mudar `schema.prisma`, migration, models e rotas afetados.
- `criar-tela` — telas/componentes mobile-first consumindo a API.
- `escrever-testes` — padrões de Jest (integration por método e unit de lógica pura).

**Antes de instalar qualquer skill de terceiro:** leia o `SKILL.md` inteiro, confira se contradiz este arquivo ou outra skill, e registre-a em `docs/skills.md`. Só instale o que o usuário aprovou. Depois de instalar (`npx skills add`), confira que `.claude/skills` continua sendo link (`ls -la .claude`) e que não surgiu cópia. Em conflito, vale esta ordem: **AGENTS.md > skills do Ordena > skills de terceiros**.

## Regras de trabalho

- **TDD:** obrigatório para models e rotas (teste de integração falhando primeiro, depois a implementação), inclusive ao corrigir bug: primeiro o teste que reproduz. Em telas e componentes não é exigido; valide com `npm run lint` e o navegador.
- **Verificação:** só diga que algo passa/está pronto depois de rodar `npm test`, `npm run lint` e `npm run format:check` e ler a saída. Relate falhas pelo nome, inclusive as que você não causou.
- **Depuração:** ache a causa raiz antes de corrigir. Nunca imprima `.env` nem segredos como "diagnóstico".
- **Revisão de código:** avalie o feedback tecnicamente antes de aplicar; não concorde por reflexo nem implemente sem verificar. Tom seco, mas com educação básica.
- **Idioma:** conversa e texto de interface em pt-BR.
- **Specs e planos:** quando houver, em `docs/specs/` e `docs/plans/` (`AAAA-MM-DD-<tema>.md`). Só para features grandes; tarefa pequena e clara não precisa de spec nem de plano.
- **Banco de teste único:** `ordena_test` (porta 5432) é compartilhado e os testes rodam em série. Nunca rode testes de integração em paralelo (vários agentes/worktrees ao mesmo tempo). Em worktree, copie o `.env` (não é versionado) antes de testar.
- **Git:** não faça commit, push, merge nem PR sem o usuário pedir.
- **Visual:** o design system (GitHub Primer, tema escuro fixo, tokens oficiais e regras de CSS Modules) está em `docs/design.md`; `criar-tela` é dono das regras mobile (toque, `dvh`, navegação).

Ao criar uma convenção nova que se repete, transforme em skill e liste aqui.
