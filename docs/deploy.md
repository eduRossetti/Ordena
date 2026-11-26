# CI, deploy e migrations

Resumo: o **CI** roda no GitHub Actions; o **deploy** é feito pela Vercel (integração com o GitHub). A `main` só recebe código por PR com o CI verde.

## Fluxo de uma mudança

1. Branch → push → PR para a `main`.
2. Em paralelo: o CI roda no GitHub e a Vercel faz um build de **Preview** (migra o banco de hml e sobe uma URL própria, atrás de login da Vercel).
3. Com os checks verdes, merge.
4. O push na `main` dispara o CI de novo e um build de **Production** (migra o banco de produção e publica em `ordena-ten.vercel.app`).

## CI (`.github/workflows/ci.yml`)

Roda em todo PR para a `main` e em todo push na `main`. Um push novo na mesma branch cancela a execução anterior. Node vem do `.nvmrc`.

| Job (nome do check) | O que faz                                                                              |
| ------------------- | -------------------------------------------------------------------------------------- |
| `Lint e formatação` | `npm run lint` e `npm run format:check`                                                |
| `Testes (Jest)`     | `test:unit` e `test:integration`, com um Postgres 17 (service container) só para o job |
| `Build (Next.js)`   | `npm run build` (não usa banco)                                                        |

O CI **não** usa o banco de hml nem o de produção. Não use `npm test` no workflow: ele sobe o Postgres via Docker Compose.

## Proteção da `main`

Push direto é recusado. A regra exige PR, os 3 checks acima e a branch atualizada com a `main`; vale também para admin, sem force-push e sem apagar a branch. O check da Vercel **não** é obrigatório.

## Deploy (Vercel)

| Origem                | Ambiente   | Banco | Domínio                                |
| --------------------- | ---------- | ----- | -------------------------------------- |
| Push na `main`        | Production | prod  | `ordena-ten.vercel.app`                |
| Outras branches e PRs | Preview    | hml   | URL própria (atrás de login da Vercel) |

Cada ambiente tem o seu banco (Prisma Postgres) e o seu `JWT_SECRET`. O app só lê duas variáveis: `DATABASE_URL` (URL direta `postgresql://`, sem aspas nem espaços) e `JWT_SECRET`. Elas ficam em Vercel → Environment Variables, com uma entrada para Production e outra para Preview. As variáveis `ORDENA_*` (prod) e `HML_*` (hml) são criadas pela integração do banco e o código não as usa.

## Migrations

O script `vercel-build` (`package.json`) roda `prisma migrate deploy --config prisma.config.js && next build`. A Vercel o usa no lugar de `build`:

1. A migration é aplicada no banco do ambiente (prod em Production, hml em Preview).
2. Só depois o código é compilado e publicado.
3. Se a migration falhar, o build para e o deploy anterior continua no ar.

O `build` normal continua só `next build` (é o que o CI usa).

O workflow **Migrations (manual)** (`.github/workflows/migrate.yml`) não roda sozinho. Dispare em Actions → Migrations (manual) → Run workflow, escolhendo `hml` ou `production`, para reaplicar ou conferir um banco sem fazer deploy. Ele usa o secret `DATABASE_URL` do GitHub Environment correspondente (`hml` / `production`).

Para ver o que foi aplicado: tabela `_prisma_migrations` do banco (`SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at;`) ou `npx prisma migrate status`.

### Janela de incompatibilidade

Entre a migration e a publicação do código novo (~1 min), o código **antigo** ainda atende contra o banco já migrado. Por isso migration que remove, renomeia ou muda o tipo de coluna/tabela é feita em duas etapas (adicionar primeiro, remover depois, em PRs separados). Detalhes na skill `alterar-banco`.

## Onde ficam os segredos

| Lugar                                       | O que guarda                                                     |
| ------------------------------------------- | ---------------------------------------------------------------- |
| Vercel → Environment Variables              | `DATABASE_URL` e `JWT_SECRET`, separados em Production e Preview |
| GitHub → Environments (`hml`, `production`) | secret `DATABASE_URL`, só para o workflow manual                 |
| Código / repositório                        | nenhum segredo (o repositório é público)                         |

Gere o `JWT_SECRET` com `openssl rand -base64 48` (diferente em cada ambiente). Trocar o segredo derruba as sessões ativas do ambiente. Variáveis só valem em deploys criados depois de salvas. `DATABASE_URL` colada com aspas, espaço ou quebra de linha dá `Can't reach database server at base`.

## Limites conhecidos

- O deploy da Vercel não espera o CI; na `main` isso é coberto pela regra de PR com checks verdes.
- Os testes rodam só no GitHub, não na Vercel.
- Todo Preview migra o mesmo banco de hml; dois PRs com migrations diferentes podem se atrapalhar nele.
- Produção migra sem aprovação humana: o merge já aplica.
- Os dois bancos dividem a cota mensal de operações do plano gratuito do Prisma Postgres.
