# Design do Ordena

Sistema de design: **GitHub Primer (`@primer/react` + `@primer/primitives`), tema escuro fixo (`dark`)**. Fundo neutro, bordas finas em vez de sombras, cor só onde carrega significado (status, prioridade, ação principal). Este arquivo é a fonte da estética do app.

O tema é **sempre escuro**, ignorando o tema do sistema operacional. Não carregamos o tema claro nem exibimos botão de alternância.

## Tokens oficiais (`@primer/primitives`)

Carregados globalmente em `src/app/globals.css` (`functional/themes/dark.css` + `primitives.css`). Use sempre os tokens oficiais do Primer — **nunca** escreva valores hex soltos em componentes ou CSS Modules.

| Token                                               | Uso                                                         |
| --------------------------------------------------- | ----------------------------------------------------------- |
| `--bgColor-default`                                 | Fundo da página (`#0d1117`)                                 |
| `--bgColor-muted`                                   | Superfícies secundárias, cards, barra inferior              |
| `--borderColor-default`                             | Bordas e divisórias (1px)                                   |
| `--fgColor-default`                                 | Texto principal                                             |
| `--fgColor-muted`                                   | Texto secundário, subtítulos, legendas                      |
| `--fgColor-accent`                                  | Links, destaque de navegação                                |
| `--bgColor-accent-emphasis`                         | Fundo de destaque de acento                                 |
| `--bgColor-accent-muted`                            | Fundo de destaque suave (selecionado)                       |
| `--button-primary-bgColor-rest`                     | Ação principal (gerenciada pelo `Button variant="primary"`) |
| `--fgColor-success` / `--bgColor-success-muted`     | Concluído, sucesso                                          |
| `--fgColor-attention` / `--bgColor-attention-muted` | Em andamento, prioridade média, atenção                     |
| `--fgColor-danger` / `--bgColor-danger-muted`       | Erro, prioridade alta, ações destrutivas                    |
| `--fgColor-done` / `--bgColor-done-muted`           | Reservado (ex.: convite aceito)                             |
| `--focus-outlineColor`                              | Anel de foco acessível                                      |
| `--base-size-*`                                     | Espaçamentos (`4`, `8`, `12`, `16`, `24`, `32`…)            |
| `--borderRadius-medium`                             | Raio padrão de campos, botões e ícones                      |

## Cores com significado de domínio

| Domínio             | Valor     | Semântica Primer |
| ------------------- | --------- | ---------------- |
| Tarefa `TODO`       | A fazer   | `muted`          |
| Tarefa `DOING`      | Fazendo   | `attention`      |
| Tarefa `DONE`       | Feita     | `success`        |
| Prioridade `LOW`    | Baixa     | `muted`          |
| Prioridade `MEDIUM` | Média     | `attention`      |
| Prioridade `HIGH`   | Alta      | `danger`         |
| Convite `PENDING`   | Pendente  | `accent`         |
| Convite `ACCEPTED`  | Aceito    | `success`        |
| Convite `DECLINED`  | Recusado  | `danger`         |
| Convite `CANCELED`  | Cancelado | `muted`          |

Prefira componentes prontos do Primer (`Label`, `StateLabel`, `Banner`) para representar estados. Nunca comunique estado só pela cor: acompanhe de texto ou ícone.

## Regras

- **Contraste:** texto normal ≥ 4,5:1 sobre o fundo. `--fgColor-muted` só para texto secundário, nunca para conteúdo essencial.
- **Ação principal:** um único `Button` com `variant="primary"` por tela. Ações secundárias usam a variante padrão (`default`). Ações destrutivas usam `variant="danger"` e pedem confirmação.
- **Foco:** mantenha o anel de foco (`--focus-outlineColor`); nunca remova o `outline` sem substituto visível para teclado (`:focus-visible`).
- **Sem sombras pesadas e sem gradientes.** Hierarquia por borda, espaçamento e peso de fonte.
- **Tipografia e escala:** gerenciadas por `BaseStyles`, `Heading` e `Text` do Primer.
- **Campos e toque no celular:** o `TextInput size="large"` do Primer tem fonte de 14px e 40px de altura, o que dá zoom automático no iOS (fonte < 16px) e alvo abaixo de 44px. Por isso o `FormField` (`src/components/ui/FormField.module.css`) força 16px de fonte e 44px de altura (inclusive no botão de ação interno, como o olho da senha), e os botões de formulário e de link ajustam `--control-large-size: 2.75rem` no próprio CSS Module. Ao criar campo ou botão novo, use esses wrappers/ajustes em vez do tamanho padrão do Primer.
- **PWA:** `theme_color` e `background_color` em `src/app/manifest.js` e `viewport.themeColor` em `src/app/layout.jsx` usam `#0d1117` (cor de `--bgColor-default`) para a barra do sistema não destoar do app.

## Como aplicar no código

1. **Tema raiz (`src/app/layout.jsx` e `src/app/globals.css`):**
   - `<html>` define `data-color-mode="dark"`, `data-dark-theme="dark"` e `data-light-theme="light"`.
   - `ThemeProvider colorMode="night"` e `BaseStyles` envolvem `{children}`.
   - `globals.css` importa `dark.css` e `primitives.css`, fixa `color-scheme: dark` e pinta `body` com `var(--bgColor-default)` e `var(--fgColor-default)`.
2. **Componentes:** use `@primer/react` (`Stack`, `Heading`, `Text`, `Button`, `LinkButton`, `Link`, `FormControl`, `TextInput`, `Banner`…) e ícones de `@primer/octicons-react`. Wrappers do projeto ficam em `src/components/ui/` (`FormField`, `PasswordField`, `StatusBanner`).
3. **CSS próprio:** apenas em `*.module.css`, usando exclusivamente tokens do Primer (`var(--bgColor-*)`, `var(--fgColor-*)`, `var(--borderColor-*)`, `var(--base-size-*)`, `var(--borderRadius-*)`), nunca hex nem utilitários de Tailwind.
