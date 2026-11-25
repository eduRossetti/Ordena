---
name: criar-endpoint
description: Cria um endpoint da API do Ordena seguindo o padrão fat model → route.js (controller), com testes de integração por método. Use sempre que for adicionar ou alterar uma rota em /api/v1.
---

# Criar endpoint

Modelo vivo: `/api/v1/status` (`src/app/api/v1/status/route.js`, `src/models/status.js`, `tests/integration/api/v1/status/`).

## Passos (nesta ordem)

1. **Contrato**: defina método, caminho (`/api/v1/<recurso>`), entrada e saída (o recurso direto, sem envelope). Liste os erros possíveis (`ValidationError`, `NotFoundError`, `ForbiddenError`, `ConflictError`...).
2. **Teste primeiro (TDD)**: antes do model e do controller, escreva o teste de integração do método (skill `escrever-testes`) e rode-o para vê-lo falhar pelo motivo certo. Depois implemente até passar.
3. **Model** (`src/models/<recurso>.js`, nome no singular): aqui mora tudo que não é HTTP.
   - Schemas Zod no próprio arquivo, **com mensagens em pt-BR explícitas** (o fallback do Zod é pt-PT); `schema.parse(input)` no início de `create`/`update` (`ZodError` vira 400 sozinho).
   - Funções que dependem de quem chama recebem o `user` como **primeiro argumento** (`create(user, groupId, input)`).
   - Regras de negócio e permissões (ex.: usuário é membro do grupo?). Lance os erros de `infra/errors` com `message` e `action` em pt-BR.
   - Acesso ao banco com `import { prisma } from 'infra/database'`. Selecione só os campos públicos (nunca `passwordHash`).
   - Funções nomeadas pelo que fazem (`create`, `findOneById`, `findAllByGroupId`, `update`) e um objeto como `export default`.
4. **Controller** (`src/app/api/v1/<recurso>/route.js`):
   - `const router = createEdgeRouter()` (de `next-connect`) e um handler por método: `router.get(getHandler)`.
   - O handler lê entrada (`await request.json()`, `await ctx.params`, `new URL(request.url).searchParams`), chama o model e responde com `Response.json(obj, { status })`. Sem regra de negócio, sem Prisma.
   - `const handler = router.handler(controller.errorHandlers)` (de `infra/controller`) e `export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE }`: exporte **todos** para que métodos não registrados devolvam 405 no formato padrão.
   - Params dinâmicos: `[id]/route.js`. Neste Next, `params` é uma **Promise**: use `await ctx.params`.
5. **Testes**: um arquivo por método em `tests/integration/api/v1/<rota>/<metodo>.test.js` (escritos no passo 2; complete os casos de erro aqui). Além dos métodos implementados, cubra os **não implementados com 405** (como `status/post.test.js`). Veja `escrever-testes`.
6. Rode `npm test && npm run lint && npm run format:check`.

## Regras

- Rotas e nomes em inglês; `message`/`action` dos erros em pt-BR.
- Rotas de grupo/tarefa: o model verifica se o usuário é membro (e o papel, se necessário).
- Status HTTP: 200 leitura/atualização, 201 criação, 204 sem corpo (`new Response(null, { status: 204 })`), 4xx via erros de `infra/errors`.
- O controller nunca importa `infra/database`; o ESLint bloqueia (`.js` e `.jsx`).
- Unicidade/concorrência: confie em índice do banco e traduza a violação (`P2002`) em `ConflictError`.
