import { GET, POST, PUT } from '@/app/api/v1/groups/[groupId]/route';
import orchestrator from '../../../../../orchestrator';

beforeEach(async () => {
  await orchestrator.clearDatabase();
});

function getGroup(groupId, cookie) {
  return GET(
    new Request(`http://localhost/api/v1/groups/${groupId}`, {
      headers: cookie ? { cookie } : {},
    }),
    { params: Promise.resolve({ groupId }) },
  );
}

describe('GET /api/v1/groups/[groupId]', () => {
  test('retorna 200 para OWNER, ADMIN e MEMBER', async () => {
    const owner = await orchestrator.createUser();
    const admin = await orchestrator.createUser();
    const member = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner, {
      name: 'República',
      description: 'Geral',
    });
    await orchestrator.addMember(group, admin, 'ADMIN');
    await orchestrator.addMember(group, member, 'MEMBER');

    for (const u of [owner, admin, member]) {
      const { cookie } = await orchestrator.createSession(u);
      const response = await getGroup(group.id, cookie);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        id: group.id,
        name: 'República',
        description: 'Geral',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    }
  });

  test('retorna 404 para não membro (não revela que o grupo existe)', async () => {
    const owner = await orchestrator.createUser();
    const outsider = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const { cookie } = await orchestrator.createSession(outsider);

    const response = await getGroup(group.id, cookie);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      name: 'NotFoundError',
      message: 'Grupo não encontrado.',
      action: 'Verifique se você ainda participa deste grupo.',
      statusCode: 404,
    });
  });

  test('retorna 404 para groupId inválido ou inexistente', async () => {
    const user = await orchestrator.createUser();
    const { cookie } = await orchestrator.createSession(user);

    const invalid = await getGroup('nao-e-uuid', cookie);
    expect(invalid.status).toBe(404);
    expect((await invalid.json()).name).toBe('NotFoundError');
  });

  test('retorna 401 sem autenticação', async () => {
    const response = await getGroup('00000000-0000-0000-0000-000000000000');
    expect(response.status).toBe(401);
  });

  test('retorna 405 para POST e PUT', async () => {
    const ctx = { params: Promise.resolve({ groupId: '00000000-0000-0000-0000-000000000000' }) };
    const postRes = await POST(
      new Request('http://localhost/api/v1/groups/x', { method: 'POST' }),
      ctx,
    );
    expect(postRes.status).toBe(405);
    const putRes = await PUT(
      new Request('http://localhost/api/v1/groups/x', { method: 'PUT' }),
      ctx,
    );
    expect(putRes.status).toBe(405);
  });
});
