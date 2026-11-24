---
name: criar-tela
description: Cria telas e componentes React do Ordena (PWA mobile-first) que consomem a API. Use ao adicionar páginas em src/app ou componentes em src/components.
---

# Criar tela

## Princípios

- **Mobile-first**: projete para ~375px; Tailwind com classes base para mobile e `sm:`/`md:` só para ampliar. Alvos de toque ≥ 44px, `min-h-dvh` em vez de `h-screen`, respeitar áreas seguras quando houver barra fixa.
- Feel de app: navegação por barra inferior, estados de carregando/vazio/erro em toda lista, sem scroll horizontal.
- Textos em **pt-BR**.
- **Dados só via API**: telas nunca importam models ou Prisma. Use `fetch` em `/api/v1/...` (no navegador, em componente `'use client'` ou hook): o sucesso é o recurso direto no corpo e o erro é `{ name, message, action, statusCode }`. Se vários lugares repetirem o `fetch` e o tratamento de erro, extraia então um cliente em `src/lib/` (ainda não existe).

## Passos

1. Rota: `src/app/(app)/<caminho>/page.jsx` (área logada) ou `(auth)/` (login/cadastro). Dinâmicas: `[groupId]`.
2. Todo arquivo com JSX é `.jsx` (componentes, `page`, `layout`); `.js` fica para código sem JSX (hooks, lib, models, `route.js`, `manifest.js`). Componentes genéricos em `src/components/ui/` (Button, Input, Modal); de domínio em `src/components/features/` (TaskCard, MemberList).
3. Componentes que usam estado/efeitos/eventos levam `'use client'`; mantenha-os pequenos e empurre o `'use client'` para as folhas.
4. Lógica de fetch/estado reutilizável vai para `src/hooks/` (`useTasks(groupId)`).
5. Trate a resposta de erro (`!response.ok`): mostre `message` e `action` ao usuário; decida o fluxo por `name` (ex.: `UnauthorizedError` → login).
6. Neste Next, `params`/`searchParams` são Promises (em Server Components, `await`; em Client Components, `use()`). Em dúvida, consulte `node_modules/next/dist/docs/`.
7. `npm run lint && npm run format`.

## Regras

- Acessibilidade: `label` em inputs, `aria-*` em ícones-botão, contraste suficiente.
- Metadata/viewport do PWA ficam em `src/app/layout.jsx` e `src/app/manifest.js`.
