# Plano — Estrutura da área logada com a navegação do app

- **Issue:** [#10 — Criar a estrutura da área logada com a navegação do app](https://github.com/eduRossetti/Ordena/issues/10)
- **Branch:** `feat/estrutura-area-logada`
- **Depende de:** PR #9 (backend de grupos, convites e tarefas), já na `main`.
- **Desbloqueia:** #11 (boas-vindas/criar grupo), #12 (lista de tarefas), #14 (grupo), #16 (modal de notificações), #22 (perfil).

## Objetivo

Transformar a área logada `(app)` num "casco" de aplicativo: barra inferior fixa com **Tarefas**, **Grupo** e **Perfil**, cabeçalho da tela Tarefas com o **sino**, dados da pessoa (`GET /api/v1/user`) disponíveis para todas as telas via `useUser`, e componentes reutilizáveis de carregando/vazio/erro. Sem backend novo: a rota `GET /user` já devolve `membership` (`{ groupId, groupName, role }` ou `null`).

## Decisões

| Tema                     | Decisão                                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ícones das abas          | `ChecklistIcon` (Tarefas), `PeopleIcon` (Grupo), `PersonIcon` (Perfil); `BellIcon` no sino. Todos de `@primer/octicons-react`.                                                                    |
| Onde busca `/user`       | Uma vez só, num `UserProvider` montado em `src/app/(app)/layout.jsx`. As telas leem com `useUser()`; nenhuma tela chama `/user` por conta própria.                                                |
| 401 após renovar         | Tratado no `UserProvider`: `apiFetch` já tenta renovar; se ainda vier 401, `router.replace('/login')`. As telas não repetem essa lógica.                                                          |
| Carregando/erro          | Cada tela decide o que mostrar com `useUser()` e os componentes `LoadingState`/`ErrorState`. A barra inferior aparece sempre (inclusive carregando ou com erro), para a pessoa nunca ficar presa. |
| Sino sem grupo           | O cabeçalho da tela Tarefas é renderizado fora da checagem de `membership`, então aparece com ou sem grupo (e também durante o carregamento).                                                     |
| Sino nesta demanda       | `NotificationBell` recebe `onClick` opcional; a #16 liga o modal e o contador. Aqui ele só é renderizado com `aria-label="Notificações"`.                                                         |
| Aba ativa                | Função pura `isTabActive(pathname, href)` em `src/lib/navigation.js`: `/` casa só com `/`; as outras casam com o próprio caminho e subcaminhos (`/group/...`). Coberta por teste unitário.        |
| URLs                     | Sem id de grupo (cada pessoa tem no máximo 1 grupo): `/`, `/group`, `/profile`.                                                                                                                   |
| Proteção das telas novas | Nada a fazer: `src/proxy.js` já protege toda tela fora de `PUBLIC_PATHS`.                                                                                                                         |
| Área segura (iPhone)     | `viewport.viewportFit = 'cover'` em `src/app/layout.jsx` para `env(safe-area-inset-bottom)` funcionar; a barra soma esse valor ao padding inferior e o conteúdo reserva a altura da barra.        |

## Arquivos

### Novos

| Arquivo                                                   | Tipo       | Responsabilidade                                                                                                                                |
| --------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/(app)/layout.jsx`                                | Server     | Monta `UserProvider` > `<div shell>` com `<main>{children}</main>` + `<BottomNav />`.                                                           |
| `src/app/(app)/layout.module.css`                         | CSS        | Shell: `min-height: 100dvh`, largura máx. ~28rem centralizada, `padding-bottom` = altura da barra + `env(safe-area-inset-bottom)`.              |
| `src/app/(app)/group/page.jsx`                            | Página     | Grupo provisória: título "Grupo"; com grupo, mostra `groupName`; sem grupo, `EmptyState`. Usa `useUser`.                                        |
| `src/app/(app)/profile/page.jsx`                          | Página     | Perfil provisória: título "Perfil", nome e `@username`. Usa `useUser`.                                                                          |
| `src/hooks/useUser.js`                                    | Hook       | Cria `UserContext` e exporta `useUser()` → `{ status: 'loading' \| 'ready' \| 'error', user, error, reload }`. Lança se usado fora do provider. |
| `src/components/features/UserProvider.jsx`                | Client     | Busca `GET /user` com `apiFetch` (com `AbortController`), guarda estado, expõe `reload`, redireciona para `/login` em 401.                      |
| `src/components/features/BottomNav.jsx` + `.module.css`   | Client     | `<nav aria-label="Navegação principal">` com 3 `Link`s (ícone + rótulo), `aria-current="page"` na aba ativa (`usePathname` + `isTabActive`).    |
| `src/components/features/TasksHeader.jsx` + `.module.css` | Client     | Cabeçalho da tela Tarefas: título (nome do grupo quando houver, senão "Tarefas") e `NotificationBell` à direita.                                |
| `src/components/features/NotificationBell.jsx`            | Client     | `IconButton` do Primer com `BellIcon`, `aria-label="Notificações"`, alvo ≥ 44px, `onClick` opcional (#16).                                      |
| `src/components/ui/LoadingState.jsx` + `.module.css`      | Client     | `Spinner` + texto ("Carregando…" por padrão), `role="status"`.                                                                                  |
| `src/components/ui/EmptyState.jsx` + `.module.css`        | Client     | Ícone opcional, título, descrição e `children` para ação (ex.: botão da #11).                                                                   |
| `src/components/ui/ErrorState.jsx`                        | Client     | `StatusBanner` crítico com `error.message` (título) e `error.action` (descrição) + botão "Tentar novamente" quando receber `onRetry`.           |
| `src/lib/navigation.js`                                   | Lib (pura) | `TABS` (`href`, `label`, ícone por nome) e `isTabActive(pathname, href)`.                                                                       |
| `tests/unit/lib/navigation.test.js`                       | Teste unit | Casos de `isTabActive`.                                                                                                                         |

### Alterados

| Arquivo                              | Mudança                                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/(app)/page.jsx`             | Vira a tela Tarefas: `TasksHeader` + conteúdo provisório via `useUser` (carregando / erro / com grupo / sem grupo).                        |
| `src/app/(app)/page.module.css`      | Remove o layout centralizado de tela cheia (passa para o `layout.module.css`) ou apaga, se não sobrar nada.                                |
| `src/app/layout.jsx`                 | `viewport.viewportFit = 'cover'`.                                                                                                          |
| `AGENTS.md`                          | Seção Domínio/Telas: área logada com `/`, `/group`, `/profile`, `UserProvider`/`useUser` e componentes de estado.                          |
| `.agents/skills/criar-tela/SKILL.md` | Regras novas: use `useUser()` (não chame `/user` na tela), `LoadingState`/`EmptyState`/`ErrorState`, a barra inferior já existe no layout. |

### Removidos

| Arquivo                                                | Motivo                                               |
| ------------------------------------------------------ | ---------------------------------------------------- |
| `src/components/features/Greeting.jsx` + `.module.css` | Substituído pelo `UserProvider` + telas provisórias. |

## Etapas

Cada etapa termina com `npm run lint` e `npm run format` limpos. Telas e componentes não exigem TDD (AGENTS.md); a lógica pura (`navigation.js`) vai com TDD.

1. **Leitura prévia (Next 16).** Ler em `node_modules/next/dist/docs/01-app/`: `03-api-reference/03-file-conventions/layout.md`, `03-api-reference/04-functions/use-pathname.md` e `03-api-reference/04-functions/generate-viewport.md` (confirmar `viewportFit`). Anotar qualquer diferença em relação ao plano.
2. **Navegação pura (TDD).** Escrever `tests/unit/lib/navigation.test.js` falhando: `/` ativo só em `/`; `/group` ativo em `/group` e `/group/membros`; `/groupies` não ativa `/group`; `/profile` idem. Implementar `src/lib/navigation.js` até passar (`npm run test:unit`).
3. **Componentes de estado.** `LoadingState`, `EmptyState`, `ErrorState` em `src/components/ui/`, só tokens do Primer, textos em pt-BR, botão de retry com 44px (`--control-large-size: 2.75rem`, como no `docs/design.md`).
4. **Dados da pessoa.** `src/hooks/useUser.js` (contexto + hook) e `UserProvider.jsx` (fetch único, `reload`, 401 → `/login`). Portar a lógica do `Greeting` (abort no unmount, `router.replace`).
5. **Casco da área logada.** `src/app/(app)/layout.jsx` + `layout.module.css`, `BottomNav` (fixa no rodapé, fundo `--bgColor-muted`, borda superior `--borderColor-default`, aba ativa com `--fgColor-accent` e indicador visível além da cor, foco com `:focus-visible`) e `viewportFit: 'cover'` no layout raiz.
6. **Tela Tarefas.** `NotificationBell`, `TasksHeader` e nova `src/app/(app)/page.jsx`: cabeçalho sempre visível; abaixo, `LoadingState` / `ErrorState` (com `reload`) / conteúdo provisório (com grupo: nome do grupo e "Em breve, suas tarefas aparecem aqui"; sem grupo: `EmptyState` "Você ainda não tem um grupo", conteúdo real na #11). Remover `Greeting`.
7. **Telas Grupo e Perfil provisórias.** `group/page.jsx` e `profile/page.jsx`, cada uma com título e o mesmo tratamento de carregando/erro.
8. **Documentação.** Atualizar `AGENTS.md` e a skill `criar-tela` (ver "Alterados").
9. **Verificação final.** `npm test`, `npm run lint`, `npm run format:check` (ler a saída e relatar falhas pelo nome) e checagem manual no navegador (abaixo).

## Verificação manual (navegador, ~375px)

Com `npm run dev` e o DevTools em modo celular (iPhone SE / 375px):

- [ ] Logado, abre `/`: barra inferior com Tarefas, Grupo e Perfil; Tarefas destacada; sino no topo.
- [ ] Toca em Grupo e Perfil: a URL muda para `/group` e `/profile` e a aba correspondente fica destacada.
- [ ] Pessoa **sem grupo**: o sino continua no cabeçalho da tela Tarefas.
- [ ] Network throttling "Slow 3G": aparece o estado de carregando antes dos dados.
- [ ] Erro em `GET /user` (ex.: bloquear a URL no DevTools): aparece o banner com `message` + `action` e o botão "Tentar novamente" funciona.
- [ ] Sessão impossível de renovar (apagar os cookies `access_token` e `refresh_token` com a tela aberta e trocar de aba): vai para `/login`.
- [ ] Sem rolagem horizontal; o fim do conteúdo não fica escondido atrás da barra; alvos de toque ≥ 44px; navegação por teclado com foco visível.

## Critérios de aceite → como são atendidos

| Critério da issue                                           | Onde                                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------- |
| Barra inferior com 3 abas e sino na tela Tarefas            | `(app)/layout.jsx` + `BottomNav`; `TasksHeader` em `page.jsx` |
| Tocar numa aba navega e destaca                             | `BottomNav` (`Link` + `isTabActive` + `aria-current`)         |
| Sino com ou sem grupo                                       | `TasksHeader` fora da checagem de `membership`                |
| Carregando enquanto `GET /user` não responde; erro com ação | `UserProvider` + `LoadingState`/`ErrorState`                  |
| 401 sem renovação → `/login`                                | `UserProvider` (`apiFetch` já renova uma vez)                 |
| 375px sem rolagem horizontal; barra não cobre o conteúdo    | `layout.module.css` (padding inferior) + verificação manual   |

## Fora de escopo

Conteúdo real de Tarefas (#12), Grupo (#14) e Perfil (#22); modal de notificações e contador no sino (#16); botão de sair (Perfil, #22); tela de boas-vindas/criar grupo (#11).

## Riscos e pontos de atenção

- **Sino inerte até a #16:** um botão que não faz nada pode confundir. Alternativa, se preferir: renderizar com `aria-disabled` até a #16.
- **`useUser` desatualizado:** depois de criar/sair do grupo (#11, #20), as telas precisam chamar `reload()` para o `membership` refletir a mudança. Documentar na skill `criar-tela`.
- **Primer `IconButton`** tem 32px no tamanho `medium`; usar `size="large"` e ajustar `--control-large-size: 2.75rem` no CSS Module para chegar a 44px.
