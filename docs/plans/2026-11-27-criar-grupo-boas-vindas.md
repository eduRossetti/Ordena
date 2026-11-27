# Plano — Criar grupo pela tela de boas-vindas

- **Issue:** [#11 — Criar grupo pela tela de boas-vindas](https://github.com/eduRossetti/Ordena/issues/11)
- **Branch:** `feat/criar-grupo-boas-vindas`
- **Depende de:** #10 (estrutura da área logada), já na `main`.
- **Relacionada:** #16 (modal de notificações / convites no sino).

## Objetivo

Quem não tem grupo (`user.membership === null`) passa a ver, em **Tarefas** (`/`) e em **Grupo** (`/group`), uma tela de boas-vindas com o botão **"Criar grupo"** e o aviso de que os convites recebidos ficam no sino, no topo da tela Tarefas. O botão abre um formulário (nome + descrição) que chama `POST /api/v1/groups`; ao criar, a pessoa vira OWNER e cai na tela Tarefas do grupo (vazia).

## O que já existe (não precisa de backend novo)

| Peça                                              | Situação                                                                                                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/v1/groups` → `group.create(user, ...)` | Pronto. Nome `trim` 1–50, descrição `trim` até 500 (vazia vira `null`), criador vira OWNER, 409 `ConflictError` se já participa de um grupo.                 |
| Testes de integração do `POST /groups`            | Prontos em `tests/integration/api/v1/groups/post.test.js` (201, descrição vazia → `null`, 409, 400, 401, unicidade). Nenhum teste de backend novo é exigido. |
| `useUser()` / `UserProvider`                      | Expõe `{ status, user, error, reload }`; `reload()` com dados já carregados mantém a tela e marca `refreshing`.                                              |
| Sino no topo de Tarefas                           | `TasksHeader` já renderiza `NotificationBell` fora da checagem de `membership` (atende a regra do sino sem grupo).                                           |
| Formulário de referência                          | `SignupForm` + `src/lib/validation/user.js` + `tests/unit/lib/validation/user.test.js`: mesmo padrão a seguir.                                               |

## Decisões

| Tema                        | Decisão                                                                                                                                                                                                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Onde fica o formulário      | Tela própria **`/group/new`** (não modal). No celular, tela cheia é mais confortável para digitar, o botão "voltar" do aparelho funciona e não há armadilha de foco. A aba **Grupo** fica ativa (`isTabActive` já casa subcaminhos).                                                            |
| Boas-vindas reutilizável    | Componente `WelcomeState` em `src/components/features/`, usado pelas duas telas: `EmptyState` com título, descrição, `LinkButton` "Criar grupo" para `/group/new` e o aviso do sino. Um só lugar para o texto.                                                                                  |
| Texto do aviso do sino      | "Recebeu um convite? Ele fica no sino de notificações, no topo da tela Tarefas." (com `BellIcon` decorativo). Em Tarefas o sino está logo acima; em Grupo o texto indica onde achar.                                                                                                            |
| Validação no navegador      | `src/lib/validation/group.js` com `validateCreateGroup(values)` → `{ data, fieldErrors }`, espelhando `createSchema` de `src/models/group.js` (mesmas mensagens, `trim`, descrição vazia → `null`). Teste unitário em `tests/unit/lib/validation/group.test.js`.                                |
| Campo de descrição          | Novo wrapper `TextareaField` em `src/components/ui/` (`FormControl` + `Textarea` do Primer), irmão do `FormField`. Mostra contador "N/500" no caption para a pessoa saber o limite.                                                                                                             |
| Depois de criar             | `await reload()` e `router.replace('/')`. `replace` para o "voltar" não reabrir o formulário.                                                                                                                                                                                                   |
| `reload()` aguardável       | Hoje `reload()` não devolve nada; ao navegar logo após chamá-lo, a tela Tarefas mostraria a boas-vindas antiga por um instante. Mudança pequena no `UserProvider`: `reload()` passa a devolver uma `Promise` que resolve quando o `GET /user` termina. Sem mudar a API pública além do retorno. |
| Quem já tem grupo em `/new` | O formulário continua acessível (ex.: outra aba). Se a pessoa já tem grupo, a API devolve 409 e o `StatusBanner` mostra `message` + `action` da API — é exatamente o 4º critério. Não redirecionamos preventivamente para não esconder esse caminho.                                            |
| Erros da API                | `StatusBanner` crítico no topo do form com foco (igual ao `SignupForm`). 400 vindo da API (divergência de regra) cai no mesmo banner.                                                                                                                                                           |
| Cancelar                    | Link/botão "Cancelar" (`router.back()` com fallback para `/group`) abaixo do botão de enviar.                                                                                                                                                                                                   |

## Arquivos

### Novos

| Arquivo                                                    | Tipo       | Responsabilidade                                                                                                                                     |
| ---------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/validation/group.js`                              | Lib (pura) | `validateCreateGroup(values)` espelhando `createSchema` do model de grupo.                                                                           |
| `tests/unit/lib/validation/group.test.js`                  | Teste unit | Casos de nome e descrição (ver etapa 2).                                                                                                             |
| `src/components/ui/TextareaField.jsx` + `.module.css`      | Client     | `FormControl` + `Textarea` com label, hint, erro e contador opcional (`maxLength` informativo, sem cortar o texto).                                  |
| `src/components/features/WelcomeState.jsx` + `.module.css` | Client     | Boas-vindas: ícone, título "Boas-vindas ao Ordena", descrição, `LinkButton` "Criar grupo" (`/group/new`, 44px) e aviso do sino.                      |
| `src/components/features/CreateGroupForm.jsx`              | Client     | Form controlado (`noValidate`), valida com `validateCreateGroup`, foco no 1º inválido, `POST /groups`, banner de erro com foco, `reload` + redirect. |
| `src/app/(app)/group/new/page.jsx`                         | Página     | `PageHeader` "Criar grupo" + `CreateGroupForm`.                                                                                                      |

### Alterados

| Arquivo                                    | Mudança                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `src/app/(app)/page.jsx`                   | Ramo "sem grupo" troca o `EmptyState` provisório por `<WelcomeState />`.                   |
| `src/app/(app)/group/page.jsx`             | Idem.                                                                                      |
| `src/components/features/UserProvider.jsx` | `reload()` devolve `Promise` resolvida ao fim do fetch (ver Decisões).                     |
| `.agents/skills/criar-tela/SKILL.md`       | Citar `TextareaField` entre os wrappers e que `reload()` pode ser aguardado após mutações. |
| `AGENTS.md`                                | Seção Domínio/Telas: `/group/new` e `WelcomeState`.                                        |

## Etapas

Cada etapa termina com `npm run lint` e `npm run format` limpos. TDD só é exigido na lógica pura (validação); telas são validadas com lint e navegador (AGENTS.md).

1. **Leitura prévia (Next 16 / Primer).** Conferir em `node_modules/next/dist/docs/01-app/` o `useRouter` (`replace`/`back`) e, no Primer, a API de `Textarea` e `LinkButton` (props de tamanho e `block`).
2. **Validação (TDD).** Escrever `tests/unit/lib/validation/group.test.js` falhando:
   - nome vazio / só espaços → "Informe o nome do grupo.";
   - nome com 51 caracteres → "O nome do grupo deve ter no máximo 50 caracteres."; 50 passa;
   - nome com espaços nas pontas é normalizado (`trim`);
   - descrição ausente ou vazia → `data.description === null`, sem erro;
   - descrição com 501 caracteres → "A descrição deve ter no máximo 500 caracteres."; 500 passa;
   - valores não-string (ex.: `undefined`) não quebram.
     Implementar `src/lib/validation/group.js` até passar (`npm run test:unit`).
3. **`reload()` aguardável.** No `UserProvider`, guardar o `resolve` pendente num `ref` e chamá-lo quando o fetch termina (sucesso, erro ou 401). Conferir que as telas atuais (que ignoram o retorno) seguem iguais.
4. **`TextareaField`.** Wrapper em `src/components/ui/`, mesmo visual do `FormField`, só tokens do Primer.
5. **`WelcomeState`.** Componente + CSS; trocar os ramos "sem grupo" de `page.jsx` e `group/page.jsx`.
6. **Formulário e tela.** `CreateGroupForm` (baseado no `SignupForm`) e `src/app/(app)/group/new/page.jsx`. Campos: "Nome do grupo" (`autoCapitalize="sentences"`, hint "Até 50 caracteres.") e "Descrição (opcional)" com contador. Botão "Criar grupo" `primary`, `large`, `block`, `loading` + `loadingAnnouncement="Criando grupo"`.
7. **Documentação.** `AGENTS.md` e skill `criar-tela` (ver "Alterados").
8. **Verificação final.** `npm test`, `npm run lint`, `npm run format:check` (ler a saída e relatar falhas pelo nome) e checagem manual abaixo.

## Verificação manual (navegador, ~375px)

Com `npm run dev` e o DevTools em modo celular (iPhone SE / 375px), com uma conta **sem grupo**:

- [ ] `/`: sino no topo e, abaixo, boas-vindas com "Criar grupo" e o aviso do sino.
- [ ] `/group`: mesma boas-vindas.
- [ ] "Criar grupo" abre `/group/new` com a aba Grupo ativa.
- [ ] Enviar com nome vazio, só espaços ou 51 caracteres: mensagem embaixo do campo, foco nele e **nenhuma** requisição na aba Network.
- [ ] Descrição com 501 caracteres: mensagem embaixo do campo, nada enviado.
- [ ] Nome válido: grupo criado, vai para `/` mostrando a tela Tarefas do grupo (sem piscar a boas-vindas); "voltar" do navegador não reabre o formulário; `/group` mostra o grupo.
- [ ] 409: com o formulário aberto em outra aba depois de criar o grupo, enviar de novo → banner com "Você já participa de um grupo." e "Saia do grupo atual para criar outro.".
- [ ] Sem rede (DevTools offline): banner de `NetworkError`, o que foi digitado continua nos campos.
- [ ] Sem rolagem horizontal; teclado virtual não esconde o botão; alvos ≥ 44px; foco visível por teclado.

## Critérios de aceite → como são atendidos

| Critério da issue                                                | Onde                                                                 |
| ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| Sem grupo, Tarefas e Grupo mostram boas-vindas com "Criar grupo" | `WelcomeState` em `(app)/page.jsx` e `(app)/group/page.jsx`          |
| Aviso de que convites ficam no sino; sino visível sem grupo      | Texto do `WelcomeState`; `TasksHeader` (já fora da checagem)         |
| Nome válido → grupo criado, pessoa OWNER, vê Tarefas do grupo    | `CreateGroupForm` → `POST /groups` (OWNER no model) → `reload` + `/` |
| Nome vazio ou > 50 → mensagem no campo e nada enviado            | `validateCreateGroup` antes do `apiFetch` + teste unitário           |
| 409 → mensagem e ação da API                                     | `StatusBanner` com `apiError.message` / `apiError.action`            |
| Validação espelhada em `src/lib/validation/group.js` com teste   | Etapa 2                                                              |

## Fora de escopo

Convidar pessoas; editar ou apagar o grupo; modal de convites e contador no sino (#16); conteúdo real da tela Tarefas (#12) e da tela Grupo (#14).

## Riscos e pontos de atenção

- **Regra duplicada:** mudou `createSchema` em `src/models/group.js`, mude `src/lib/validation/group.js` (comentário no topo do arquivo, como em `validation/user.js`).
- **Contagem de caracteres:** o Zod conta unidades UTF-16 (`string.length`); o espelho deve usar o mesmo `length` para não divergir com emojis.
- **Sino ainda inerte:** a boas-vindas aponta para o sino, mas o modal só chega na #16. O texto não promete ação imediata, só onde os convites aparecerão.
