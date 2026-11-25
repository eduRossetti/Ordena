# Inventário de skills

Fonte única: `.agents/skills/` (`.claude/skills` é link simbólico). Precedência: **AGENTS.md > skills do Ordena > terceiros**. Regras de convivência estão no AGENTS.md.

Política: poucas skills, cada uma com um dono de assunto. Antes de instalar uma de terceiro: ler o `SKILL.md` inteiro, checar contradições e registrar aqui.

## Instaladas

| Skill                            | Origem      | Faz                                                             | Dona de                      |
| -------------------------------- | ----------- | --------------------------------------------------------------- | ---------------------------- |
| `criar-endpoint`                 | Ordena      | Fatia teste → model → `route.js` (controller)                   | Padrão de API                |
| `alterar-banco`                  | Ordena      | Schema Prisma, migration, models afetados                       | Banco                        |
| `criar-tela`                     | Ordena      | Telas/componentes mobile-first via API                          | Regras mobile e de tela      |
| `escrever-testes`                | Ordena      | Padrões Jest (integration por método, unit de lógica pura)      | Testes                       |
| `verification-before-completion` | Superpowers | Só afirma "passou/pronto" após rodar e ler os comandos          | Definição de pronto          |
| `systematic-debugging`           | Superpowers | Causa raiz antes de corrigir; teste que reproduz o bug          | Depuração                    |
| `test-driven-development`        | Superpowers | Teste falhando primeiro (só models e rotas no Ordena)           | Ordem de trabalho com testes |
| `receiving-code-review`          | Superpowers | Avalia feedback de revisão com rigor, sem concordar por reflexo | Resposta a revisões          |
| `frontend-design`                | Anthropic   | Direção visual (estética); não decide regras mobile             | Estética                     |

Pontos de atenção já resolvidos no AGENTS.md: TDD escopado a models e rotas, nomes `superpowers:<nome>` citados dentro das skills, nada de imprimir segredos ao depurar.

Alteração local: os exemplos das skills `test-driven-development` e `systematic-debugging` foram convertidos de TypeScript para JavaScript (o `computedHash` do `skills-lock.json` não bate mais com o upstream; `npx skills update` os sobrescreveria).

## Removidas

Outras 11 do Superpowers (brainstorming, writing-plans, executing-plans, subagent-driven-development, dispatching-parallel-agents, using-git-worktrees, finishing-a-development-branch, requesting-code-review, using-superpowers, writing-skills, diagnosing-superpowers): pesadas e em atrito com o banco de teste único, o commit direto na `main` e o fluxo de docs. Podem voltar uma a uma se houver necessidade clara.

## Candidatas futuras (não instaladas)

`web-design-guidelines` (revisão de UI), skill `pwa` própria (Serwist), `docs/design.md`.
