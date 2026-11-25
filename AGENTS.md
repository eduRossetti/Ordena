# Ordena — guia para agentes

App de tarefas **compartilhadas em grupo**, usado como PWA no celular (instalado pelo navegador).
Usuários criam grupos, convidam pessoas pelo **username** (único) e atribuem tarefas a uma ou várias pessoas.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Stack

Next.js (App Router) · JavaScript (sem TypeScript) · React · Tailwind · Prisma 7 + PostgreSQL · next-connect · Zod · Jest · ESLint · Prettier.
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

`infra/` guarda o que é transversal: `controller.js` (`errorHandlers`: `onError` e `onNoMatch`), `errors.js` (erros públicos), `database.js` (Prisma singleton), `prisma/` (schema + migrations), `compose.yaml` (Postgres).
O ESLint **bloqueia** importar `infra/database` (e o client Prisma) em `.js`/`.jsx` fora de `src/models/`.

### Padrão de controller (`route.js`)

```js
import { createEdgeRouter } from 'next-connect';
import controller from 'infra/controller';
import task from '@/models/task';

const router = createEdgeRouter();
router.get(getHandler);
router.post(postHandler);

// Exporte todos os métodos: os não registrados caem no onNoMatch (405).
const handler = router.handler(controller.errorHandlers);
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };

// `user` = usuário autenticado (a autenticação ainda não existe; veja "Usuário autenticado").
async function getHandler(request, ctx) {
  const { groupId } = await ctx.params;
  return Response.json(await task.findAllByGroupId(user, groupId), { status: 200 });
}

async function postHandler(request, ctx) {
  const { groupId } = await ctx.params;
  const newTask = await task.create(user, groupId, await request.json());
  return Response.json(newTask, { status: 201 });
}
```

### Usuário autenticado

Todo model que depende de quem chama recebe o **usuário como primeiro argumento** (`task.create(user, groupId, input)`) e faz a checagem de membro/papel com ele. O controller só obtém o usuário (sessão) e repassa; nunca decide permissão. Enquanto o login não existe, não crie endpoints de grupo/tarefa: implemente a autenticação antes, ou os testes passam um usuário criado direto no banco.

### Padrão de model

Funções no arquivo e um objeto como `export default` (`task.create`, `task.findOneById`). Schemas Zod ficam no próprio model e são aplicados no início de `create`/`update` (`schema.parse(input)`). Nunca devolva `passwordHash`: selecione só os campos públicos.

Referência viva: `/api/v1/status` (`src/app/api/v1/status/route.js` → `src/models/status.js` + `tests/integration/api/v1/status/`).

### Contrato da API

- Prefixo `/api/v1`. Sucesso: o **recurso direto** no corpo (sem envelope), com status 200/201 (204 sem corpo).
- Erro: `{ "name", "message", "action", "statusCode" }`. `message` diz o que houve e `action` diz o que o usuário deve fazer (pt-BR).
- Models lançam `ValidationError` 400, `UnauthorizedError` 401, `ForbiddenError` 403, `NotFoundError` 404, `ConflictError` 409. `ZodError` vira `ValidationError`; método não registrado vira `MethodNotAllowedError` 405; qualquer outro erro vira `InternalServerError` 500.
- Toda rota de grupo/tarefa deve checar que o usuário autenticado é **membro** do grupo (no model, usando o `user` recebido).
- `message` de erro de validação em pt-BR: passe mensagens explícitas nos schemas Zod (o fallback do Zod é pt-PT).

## Domínio

User (`username` único) · Group · GroupMember (role OWNER/ADMIN/MEMBER) · GroupInvite (convite por username: PENDING/ACCEPTED/DECLINED/CANCELED) · Task (TODO/DOING/DONE, prioridade) · TaskAssignee (N:N, várias pessoas por tarefa).
Schema em `infra/prisma/schema.prisma`; detalhes em `docs/arquitetura.md`.
Login será e-mail + senha (Auth.js Credentials, `bcryptjs`) — ainda **não implementado**.

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
2. Mudou o schema → migration criada e commitada (nunca editar migration já aplicada).
3. Endpoint novo → um teste de integração por método e segue o padrão controller → model.
4. Sem segredos no git (`.env` é local; só `.env.example` é versionado).

## Skills (`.agents/skills/`)

Fonte única das skills: `.agents/skills/` (lida por Codex e Antigravity). `.claude/skills` é um link simbólico para ela (Claude Code).

> **Regra para qualquer IA:** crie, edite e apague skills **somente em `.agents/skills/`**. Nunca escreva em `.claude/skills/` (é o mesmo diretório por link; criar lá confunde e pode quebrar o link). Não copie skills para outras pastas (`.cursor/`, `.codex/`, etc.).

**Antes de instalar qualquer skill de terceiro:** leia o `SKILL.md` inteiro, confira se contradiz este arquivo ou outra skill, e registre-a em `docs/skills.md`. Só instale o que o usuário aprovou.

Skills de terceiros entram com `npx skills add` (registradas em `skills-lock.json`) e sem conteúdo específico de uma ferramenta. Depois de instalar, confira que `.claude/skills` continua sendo link (`ls -la .claude`) e que não surgiu cópia.

- `criar-endpoint` — fatia completa model → `route.js` (controller) + testes.
- `alterar-banco` — mudar `schema.prisma`, migration, models e rotas afetados.
- `criar-tela` — telas/componentes mobile-first consumindo a API.
- `escrever-testes` — padrões de Jest (integration por método e unit de lógica pura).
- `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `receiving-code-review` — (terceiros, Superpowers) processo de qualidade; veja as regras abaixo.
- `frontend-design` — (terceiro, Anthropic) direção visual de telas novas; siga junto com `criar-tela` e as regras mobile-first.

### Regras de precedência e de convivência entre skills

Ordem de autoridade: **AGENTS.md > skills do Ordena > skills de terceiros**. Inventário (o que cada skill faz, dono do assunto, quais são opcionais): `docs/skills.md`.

- **Idioma:** conversa e texto de interface em pt-BR, mesmo que a skill de terceiro esteja em inglês. Os exemplos das skills de terceiros foram convertidos para JavaScript/Jest (alteração local: `npx skills update` os sobrescreveria; refaça a conversão se atualizar).
- **Onde gravar skills:** só em `.agents/skills/`.
- **Specs e planos:** quando houver, em `docs/specs/` e `docs/plans/` (`AAAA-MM-DD-<tema>.md`). Só para features grandes.
- **TDD:** obrigatório para models e rotas (teste de integração falhando primeiro, depois a implementação), inclusive ao corrigir bug: primeiro o teste que reproduz. Em telas e componentes não é exigido (a regra "apague o código escrito antes do teste" da skill `test-driven-development` vale só para models e rotas); valide com `npm run lint` e o navegador.
- **Verificação e depuração:** só diga que algo passa/está pronto depois de rodar `npm test`, `npm run lint` e `npm run format:check` e ler a saída (`verification-before-completion`). Ao depurar, ache a causa raiz antes de corrigir (`systematic-debugging`); nunca imprima `.env` nem segredos como "diagnóstico".
- **Nomes das skills:** as skills de terceiros citam `superpowers:<nome>`; aqui elas se chamam só `<nome>`.
- **Respostas ao usuário:** em pt-BR; o tom seco do `receiving-code-review` (sem "você tem toda razão!") vale, mas educação básica também.
- **Proporção:** tarefa pequena e clara não precisa de spec nem de plano.
- **Banco de teste único:** `ordena_test` (porta 5432) é compartilhado e os testes rodam em série. Nunca rode testes de integração em paralelo (vários agentes/worktrees ao mesmo tempo). Em worktree, copie o `.env` (não é versionado) antes de testar.
- **Git:** não faça commit, push, merge nem PR sem o usuário pedir.
- **Visual:** `frontend-design` define a estética; `criar-tela` é dono das regras mobile (toque, `dvh`, navegação). Em conflito de estética, vale `docs/design.md` quando existir.

Ao criar uma convenção nova que se repete, transforme em skill e liste aqui.
