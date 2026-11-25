---
name: escrever-testes
description: Padrões de teste Jest do Ordena (integration por método chamando o handler da rota com banco de teste; unit só para lógica pura de model). Use ao criar ou corrigir testes.
---

# Escrever testes

Config: `jest.config.mjs` (projetos `unit` e `integration`). Scripts: `npm test` (sobe o banco antes), `test:unit`, `test:integration`, `test:watch` (usam `--experimental-vm-modules`, exigido pelo Prisma no Jest).

## Integration (`tests/integration/api/v1/<rota>/<metodo>.test.js`)

- Um arquivo por método HTTP, como no clone-tabnews: `status/get.test.js`, `status/post.test.js`.
- Chame o handler exportado pelo `route.js` direto: `GET(new Request('http://localhost/api/v1/...'), { params: Promise.resolve({ groupId }) })` (no Next 16 `params` é Promise). Asserte `response.status` e o corpo com `toEqual` (o recurso direto, ou o erro `{ name, message, action, statusCode }`).
- Banco `ordena_test` (`tests/integration/setup-env.js`). O `global-setup.js` aplica as migrations sozinho antes da suíte. `disconnect-prisma.js` desconecta o Prisma. `npm test` roda com `--runInBand`: arquivos compartilham o mesmo banco, então nunca remova isso sem isolar os dados.
- Dados: helpers compartilhados vão em `tests/orchestrator.js` (crie quando surgirem: `clearDatabase`, `createUser`, `createGroup`...). Cada arquivo prepara o que precisa no `beforeAll`/`beforeEach`.
- Exemplos: `tests/integration/api/v1/status/`.

## Unit (`tests/unit/**.test.js`)

- Só para lógica pura de model, sem banco (ex.: regras de permissão por papel). Não mocke o Prisma para testar query: isso é trabalho do teste de integração.

## Regras

- Um teste = um comportamento; nomes em pt-BR descrevendo o resultado ("retorna 403 quando não é membro").
- Sem dependência de ordem ou de dados que outro arquivo criou.
- Endpoint novo cobre, quando aplicável: sucesso, validação (400), não autenticado (401), sem permissão (403), não encontrado (404), conflito (409) e método não permitido (405).
