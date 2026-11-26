import { apiFetch, refreshSession } from '@/lib/api';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const unauthorized = () =>
  json({ name: 'UnauthorizedError', message: 'Sessão inválida.', action: 'Entre.' }, 401);

// Responde por rota: cada valor é uma lista de respostas, consumidas em ordem.
function mockRoutes(routes) {
  const calls = [];
  global.fetch = jest.fn(async (url, init) => {
    const key = `${init?.method ?? 'GET'} ${url}`;
    calls.push(key);
    const queue = routes[key];
    if (!queue?.length) throw new Error(`Sem resposta mockada para ${key}`);
    return queue.length > 1 ? queue.shift() : queue[0];
  });
  return calls;
}

afterEach(() => {
  delete global.fetch;
});

describe('apiFetch com renovação automática de sessão', () => {
  test('401 → renova a sessão → repete a chamada e devolve o sucesso', async () => {
    const calls = mockRoutes({
      'GET /api/v1/user': [unauthorized(), json({ id: '1' })],
      'POST /api/v1/sessions/refresh': [json({ user: {} })],
    });

    const result = await apiFetch('/user');

    expect(result).toEqual({ ok: true, status: 200, data: { id: '1' } });
    expect(calls).toEqual([
      'GET /api/v1/user',
      'POST /api/v1/sessions/refresh',
      'GET /api/v1/user',
    ]);
  });

  test('se a renovação falha, devolve o 401 original sem repetir a chamada', async () => {
    const calls = mockRoutes({
      'GET /api/v1/user': [unauthorized()],
      'POST /api/v1/sessions/refresh': [unauthorized()],
    });

    const result = await apiFetch('/user');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error.name).toBe('UnauthorizedError');
    expect(calls).toEqual(['GET /api/v1/user', 'POST /api/v1/sessions/refresh']);
  });

  test('só tenta uma vez: se a repetição também der 401, não entra em laço', async () => {
    const calls = mockRoutes({
      'GET /api/v1/user': [unauthorized()],
      'POST /api/v1/sessions/refresh': [json({ user: {} })],
    });

    const result = await apiFetch('/user');

    expect(result.status).toBe(401);
    expect(calls.filter((c) => c.includes('refresh'))).toHaveLength(1);
    expect(calls.filter((c) => c === 'GET /api/v1/user')).toHaveLength(2);
  });

  test('falha de rede na renovação conta como renovação que falhou', async () => {
    const calls = [];
    global.fetch = jest.fn(async (url, init) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.endsWith('/refresh')) throw new TypeError('Failed to fetch');
      return unauthorized();
    });

    const result = await apiFetch('/user');

    expect(result.status).toBe(401);
    expect(calls).toHaveLength(2);
  });

  test.each([
    ['POST', '/sessions'],
    ['POST', '/users'],
    ['DELETE', '/sessions'],
    ['POST', '/sessions/refresh'],
  ])('%s %s: 401 não dispara renovação', async (method, path) => {
    const calls = mockRoutes({ [`${method} /api/v1${path}`]: [unauthorized()] });

    const result = await apiFetch(path, { method, body: method === 'POST' ? {} : undefined });

    expect(result.status).toBe(401);
    expect(calls).toHaveLength(1);
  });

  test('várias chamadas com 401 ao mesmo tempo renovam uma única vez', async () => {
    const calls = mockRoutes({
      'GET /api/v1/user': [unauthorized(), unauthorized(), unauthorized(), json({ id: '1' })],
      'POST /api/v1/sessions/refresh': [json({ user: {} })],
    });

    const results = await Promise.all([apiFetch('/user'), apiFetch('/user'), apiFetch('/user')]);

    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(calls.filter((c) => c.includes('refresh'))).toHaveLength(1);
  });

  test('resposta que não é 401 não renova', async () => {
    const calls = mockRoutes({
      'GET /api/v1/user': [json({ name: 'ForbiddenError', message: 'Negado.' }, 403)],
    });

    const result = await apiFetch('/user');

    expect(result.status).toBe(403);
    expect(calls).toEqual(['GET /api/v1/user']);
  });
});

describe('refreshSession', () => {
  test('devolve true quando a renovação dá certo e false quando não', async () => {
    mockRoutes({ 'POST /api/v1/sessions/refresh': [json({ user: {} })] });
    expect(await refreshSession()).toBe(true);

    mockRoutes({ 'POST /api/v1/sessions/refresh': [unauthorized()] });
    expect(await refreshSession()).toBe(false);
  });

  test('chamadas simultâneas compartilham a mesma renovação', async () => {
    const calls = mockRoutes({ 'POST /api/v1/sessions/refresh': [json({ user: {} })] });
    const [a, b] = await Promise.all([refreshSession(), refreshSession()]);
    expect([a, b]).toEqual([true, true]);
    expect(calls).toHaveLength(1);
  });
});
