# Plano — Migrar o front para o GitHub Primer (tema escuro fixo)

Escopo: só frontend e documentação. API, models, banco e testes de integração não mudam.

## Decisões (respondidas pelo usuário)

| Tema     | Decisão                                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Tailwind | **Removido.** Componentes e layout vêm do Primer; o que sobrar de CSS próprio vai em CSS Modules usando só tokens do Primer. |
| Tema     | **Escuro fixo** (`dark`, fundo `#0d1117`), ignorando o tema do aparelho. Sem botão de alternância, sem tema claro carregado. |
| Marca    | **Ícone atual mantido** (`public/icons/`, usado no topo do login). Só `manifest` e `themeColor` mudam para o fundo escuro.   |

## O que a pesquisa mostrou

Versões verificadas no npm e no conteúdo dos pacotes: `@primer/react` 38.47.0 e `@primer/primitives` 11.10.0.

- O Primer React 38 **não usa styled-components** (nenhuma referência no `dist`); o estilo vem de CSS Modules. O `peerDependencies` aceita React 18 e 19.
- O `dist/index.js` já tem `'use client'`. O `layout.jsx` continua Server Component (precisa exportar `metadata` e `viewport`) e só renderiza o `ThemeProvider` dentro dele.
- O fundo escuro do Primer (`--bgColor-default: #0d1117`, `--bgColor-muted: #151b23`, `--borderColor-default: #3d444d`) é **idêntico** ao `docs/design.md` atual. A cor da página não muda; muda a fonte (tokens oficiais) e os componentes.
- Tokens vêm do `@primer/primitives` em CSS: `dist/css/functional/themes/dark.css` (as cores) e `dist/css/primitives.css` (tamanhos, espaçamento, tipografia). O `dark.css` só vale com `data-color-mode="dark"` e `data-dark-theme="dark"` no `<html>`.
- O `BaseStyles` zera a margem do `body`, aplica `box-sizing`, fonte e cor padrão, mas **não pinta o fundo da página** nem define `color-scheme` fora de inputs. Isso é nosso (ver `globals.css`).
- O Primer já tem `FormControl` + `TextInput` (com `trailingAction`), `Button` (`loading`, `block`), `Banner`, `Stack`, `Heading`, `Text`, `Link` e `LinkButton`.
- O `Banner` não tem `role="alert"` próprio: o foco programático e o anúncio de erro continuam por um wrapper nosso.

## Arquivos

### Dependências e configuração

| Arquivo               | Mudança                                                                                                                                                                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`        | Adicionar `@primer/react@38.47.0`, `@primer/primitives@11.10.0` e `@primer/octicons-react` (usamos `EyeIcon`/`EyeClosedIcon` direto, então declaramos). Remover `tailwindcss` e `@tailwindcss/turbopack`.                                                                                                       |
| `next.config.mjs`     | Remover a regra `turbopack.rules['*.css']` (o loader do Tailwind passaria a processar também o CSS do Primer). Se o build pedir, acrescentar `transpilePackages: ['@primer/react']`.                                                                                                                            |
| `src/app/layout.jsx`  | `<html lang="pt-BR" data-color-mode="dark" data-dark-theme="dark" data-light-theme="light" suppressHydrationWarning>`, `ThemeProvider colorMode="night"` e `BaseStyles` envolvendo `{children}`. `viewport`: `themeColor: '#0d1117'` e `colorScheme: 'dark'` (sem as duas entradas por `prefers-color-scheme`). |
| `src/app/manifest.js` | `theme_color` e `background_color` passam a `#0d1117`.                                                                                                                                                                                                                                                          |
| `src/app/globals.css` | Reescrito: `@import` de `dark.css` e `primitives.css`; `html { color-scheme: dark }`; `body { background: var(--bgColor-default); color: var(--fgColor-default); min-height: 100dvh }`. Saem `@import 'tailwindcss'`, as variáveis `--background`/`--surface`… e `@theme inline`.                               |

### Componentes

Mapa do que existe hoje para o Primer:

| Hoje (`src/components/ui/`) | Passa a ser                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Button.jsx`                | **Removido.** Usa `Button` do Primer direto (`variant="primary"`, `block`, `size="large"`, `loading`, `loadingAnnouncement`).                                                                          |
| `TextField.jsx`             | **Substituído** por `FormField.jsx`: `FormControl` + `FormControl.Label` + `TextInput block` + `FormControl.Caption` (dica) + `FormControl.Validation variant="error"`. Aceita `ref`, `error`, `hint`. |
| `PasswordField.jsx`         | Mantido, agora sobre `FormField` com `TextInput trailingAction={<TextInput.Action icon={…} aria-label="Mostrar senha" />}`, `EyeIcon`/`EyeClosedIcon` e `aria-pressed`.                                |
| `Alert.jsx`                 | **Substituído** por `Banner` (`variant="critical"` para erro, `"success"` para conta criada) dentro de um wrapper `div` com `role`, `tabIndex={-1}` e `ref`, para manter o foco depois do envio.       |

Telas e formulários (troca de classes Tailwind por componentes Primer):

| Arquivo                                                                     | Mudança                                                                                                                                                           |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/features/SignupForm.jsx`                                    | `Stack` no lugar de `flex flex-col gap-4`; `FormField`/`PasswordField`; `Button` primário; link "Entrar" com `Link` do Primer (via `as={NextLink}`).              |
| `src/components/features/LoginForm.jsx`                                     | Igual ao cadastro, com o `Banner` de sucesso e o de erro.                                                                                                         |
| `src/components/features/Greeting.jsx`                                      | `Heading`, `Text` e `Stack`; "Entrar" e "Criar conta" como `LinkButton` (`variant="primary"` e padrão); erro em `Banner`.                                         |
| `src/app/(auth)/layout.jsx` + `layout.module.css`                           | Container centralizado (`max-width`, `min-height: 100dvh`, padding com `var(--base-size-16)`) em CSS Module, com o ícone e a marca. Título "Ordena" em `Heading`. |
| `src/app/(app)/page.jsx`, `(auth)/signup/page.jsx`, `(auth)/login/page.jsx` | `Heading` e `Text` (`fgColor-muted` para o subtítulo) no lugar das classes `text-2xl`, `text-muted`, `mt-1 mb-6`.                                                 |

Regra para CSS próprio daqui em diante: só em `*.module.css`, só com tokens (`var(--bgColor-*)`, `var(--fgColor-*)`, `var(--borderColor-*)`, `var(--base-size-*)`), nunca hex.

### Documentação

- `docs/design.md`: reescrito para "GitHub Primer, tema escuro fixo". Tokens oficiais (`--bgColor-default`, `--fgColor-muted`, `--borderColor-default`, `--bgColor-accent-emphasis`…), mapa de domínio (status da tarefa → `attention`/`success`…), regras mantidas (1 botão primário por tela, foco visível, contraste, nunca só cor) e como aplicar (`ThemeProvider`, `BaseStyles`, CSS Modules). Sai a tabela de hex própria e o bloco de Tailwind.
- `AGENTS.md`: Stack troca "Tailwind" por "GitHub Primer (`@primer/react`)"; na regra "Visual", apontar para o `design.md` novo.
- `.agents/skills/criar-tela/SKILL.md`: troca as menções a Tailwind (`sm:`/`md:`, classes) por Primer + CSS Modules; lista os componentes de `src/components/ui/` novos; a regra de formulário continua.
- `docs/arquitetura.md`: uma linha na descrição do front.

## Ordem de execução

1. **Branch:** nova, a partir da atual (ver "Antes de começar").
2. **Spike de instalação:** instalar os pacotes, remover o Tailwind, reescrever `globals.css`, `layout.jsx` e `next.config.mjs`, e rodar `npm run build` com uma página mínima usando `Button`. É aqui que aparece qualquer problema de CSS do Primer com o Turbopack ou de `transpilePackages`. Só segue se o build e o `next dev` passarem.
3. Componentes: `FormField`, `PasswordField`, wrapper de `Banner`; apagar `Button`, `TextField` e `Alert` antigos.
4. Formulários, `Greeting`, layout `(auth)` e páginas.
5. Documentação.
6. Verificação.

## Verificação

1. `npm run lint`, `npm run format:check`, `npm test` e `npm run build` passando (os 63 testes não deveriam mudar).
2. `grep` confirmando que não sobrou `tailwind`, `className="…flex`/`px-`/`text-` nem `@/components/ui/(Button|TextField|Alert)`.
3. No navegador (`/signup`, `/login`, `/`):
   - o fundo escuro cobre a viewport inteira, inclusive com scroll e no "bounce" do celular;
   - ignora o tema claro do sistema (emular `prefers-color-scheme: light`);
   - cada caso da issue ainda funciona: campos vazios, 409, senha errada, falha de rede, login → home;
   - Mostrar/Ocultar senha, foco no primeiro campo inválido e no alerta, anel de foco visível só pelo teclado;
   - alvo de toque ≥ 44px em ponteiro `coarse` (o Primer ajusta por token; conferir) e sem scroll horizontal a 375px;
   - sem aviso de hidratação no console.

## Riscos

- **Turbopack + CSS do Primer:** a regra atual de `*.css` mandaria o CSS do pacote pelo loader do Tailwind. Removê-la deve bastar; o spike do passo 2 confirma.
- **`Link as={NextLink}` e `LinkButton`:** conferir se o `LinkButton` aceita `as`/`href` do Next sem recarregar a página; senão, `Link` estilizado.
- **Foco no `Banner`:** como ele não tem `role="alert"`, o wrapper precisa anunciar o erro; testar com o foco programático.
- **Tamanho do bundle:** o barrel `@primer/react` é grande. Se o `next build` mostrar crescimento relevante, avaliar `optimizePackageImports`.
- **Visual muda de fato:** o Primer tem campos, botões e espaçamentos próprios, então as telas ficam parecidas com o GitHub e diferentes das de hoje. Os critérios de aceite da issue #2 não mudam.

## Fora de escopo

Tema claro e alternância de tema; novo ícone/logo; telas de grupos e tarefas; qualquer mudança na API.

## Antes de começar

O trabalho da issue #2 ainda está **sem commit** na branch `feat/telas-login-cadastro`. Esta migração reescreve esses mesmos arquivos. O ideal é commitar a issue #2 antes e criar `feat/primer-design-system` a partir dela, para a troca de estilo virar um diff separado e revisável.
