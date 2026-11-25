# Inventário de skills

Fonte única: `.agents/skills/` (`.claude/skills` é link simbólico). Precedência: **AGENTS.md > skills do Ordena > terceiros**. As regras de trabalho (TDD, verificação, depuração, revisão) estão no AGENTS.md.

Política: poucas skills, cada uma com um dono de assunto. Antes de instalar uma de terceiro: ler o `SKILL.md` inteiro, checar contradições e registrar aqui.

## Instaladas

| Skill             | Origem | Faz                                                        | Dona de        |
| ----------------- | ------ | ---------------------------------------------------------- | -------------- |
| `criar-endpoint`  | Ordena | Fatia teste → model → `route.js` (controller)              | Padrão de API  |
| `alterar-banco`   | Ordena | Schema Prisma, migration, models afetados                  | Banco          |
| `criar-tela`      | Ordena | Telas/componentes mobile-first via API                     | Regras de tela |
| `escrever-testes` | Ordena | Padrões Jest (integration por método, unit de lógica pura) | Testes         |
