---
name: criar-tela
description: Cria telas e componentes React do Ordena (PWA mobile-first) que consomem a API. Use ao adicionar páginas em src/app ou componentes em src/components.
---

# Criar tela

## Princípios

- **Mobile-first**: projete para ~375px; use componentes de layout do Primer (`Stack`) e, quando precisar de CSS próprio, crie um `*.module.css` usando apenas tokens do Primer (`var(--bgColor-*)`, `var(--fgColor-*)`, `var(--borderColor-*)`, `var(--base-size-*)`), nunca valores hex. Alvos de toque ≥ 44px, `min-height: 100dvh` em vez de `100vh`, respeitar áreas seguras quando houver barra fixa.
- **GitHub Primer (`@primer/react`) em tema escuro fixo**: siga `docs/design.md`. Prefira componentes prontos (`Stack`, `Heading`, `Text`, `Button`, `LinkButton`, `Link`, `Banner`…) e ícones de `@primer/octicons-react`.
- Feel de app: navegação por barra inferior, estados de carregando/vazio/erro em toda lista, sem scroll horizontal.
- Textos em **pt-BR**.
- **Dados só via API**: telas nunca importam models ou Prisma. Chame a API com `apiFetch` de `src/lib/api.js` (no navegador, em componente `'use client'` ou hook): devolve `{ ok, status, data }` ou `{ ok: false, status, error }`, com `error` = `{ name, message, action, statusCode }` (falha de rede vira `NetworkError`). Não lança, exceto `AbortError`.

## Passos

1. Rota: `src/app/(app)/<caminho>/page.jsx` (área logada) ou `(auth)/` (login/cadastro). A área logada `(app)` já traz `UserProvider`, o container mobile (`max-width: 28rem` + padding inferior da barra) e a `BottomNav` (Tarefas `/`, Grupo `/group`, Perfil `/profile`) em `src/app/(app)/layout.jsx` — não recrie a barra nas páginas.
2. Todo arquivo com JSX é `.jsx` (componentes, `page`, `layout`); `.js` fica para código sem JSX (hooks, lib, models, `route.js`, `manifest.js`). Wrappers genéricos sobre o Primer ficam em `src/components/ui/` (`FormField`, `PasswordField`, `TextareaField`, `StatusBanner`, `PageHeader`, `LoadingState`, `EmptyState`, `ErrorState`); componentes de domínio ficam em `src/components/features/` (`SignupForm`, `LoginForm`, `UserProvider`, `BottomNav`, `TasksHeader`, `NotificationBell`, `WelcomeState`, `CreateGroupForm`, `TaskCard`, `MemberList`).
3. Dados da pessoa logada: leia com `useUser()` de `src/hooks/useUser.js` (`{ status, user, error, reload }`). **Não** chame `GET /user` por conta própria na tela. Depois de mutações que mudam o `membership` (criar grupo, aceitar convite, sair do grupo), chame `await reload()` para atualizar o contexto antes de navegar.
4. Estados de tela: use `LoadingState`, `EmptyState` e `ErrorState` (passando `error` e `onRetry`) de `src/components/ui/` para manter consistência visual e acessibilidade.
5. Componentes que usam estado/efeitos/eventos levam `'use client'`; mantenha-os pequenos e empurre o `'use client'` para as folhas.
6. Lógica de fetch/estado reutilizável vai para `src/hooks/` (`useTasks(groupId)`).
7. Trate a resposta de erro (`!result.ok`): mostre `message` e `action` ao usuário; decida o fluxo por `name` (ex.: `UnauthorizedError` → login).
8. Neste Next, `params`/`searchParams` são Promises (em Server Components, `await`; em Client Components, `use()`). Em dúvida, consulte `node_modules/next/dist/docs/`.
9. `npm run lint && npm run format`.

## Rotas protegidas

- Toda tela exige sessão: `src/proxy.js` redireciona para `/login` quem não tem JWT de acesso válido. Só `/login` e `/signup` são públicas (`PUBLIC_PATHS`); não crie checagem de sessão por tela.
- Sessão vencida é renovada sozinha: o proxy leva a `/refresh` e `apiFetch` renova e repete a chamada ao receber 401 (nunca chame `/sessions/refresh` na mão; use `refreshSession` de `src/lib/api.js`, que evita renovações simultâneas, pois o refresh token rotaciona e reuso derruba as sessões).
- Se `apiFetch` ainda devolver 401 (renovação falhou), faça `router.replace('/login')`.
- O proxy só autentica; "sem permissão" (403) é tratado por tela/model, não aqui.

## Formulários

- `onSubmit` com estado controlado e `noValidate`. Evite `<form action>`/`useActionState`: o React 19 reseta campos não controlados após a action e a pessoa perde o que digitou num erro.
- Valide antes de enviar com as regras do model espelhadas em `src/lib/validation/<recurso>.js` (função pura + teste em `tests/unit/lib/`), erro embaixo do campo e foco no primeiro inválido. Erro da API vai num `StatusBanner` no topo do form, com foco nele.
- Use `FormField`, `PasswordField`, `TextareaField` e `StatusBanner` de `src/components/ui/`, e `Button`/`LinkButton`/`Link`/`Stack` direto de `@primer/react`.

## Regras

- Acessibilidade: `label` em inputs, `aria-*` em ícones-botão, contraste suficiente, foco visível no teclado.
- Metadata/viewport do PWA ficam em `src/app/layout.jsx` e `src/app/manifest.js` (tema escuro fixo `#0d1117`).
