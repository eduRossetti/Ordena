import { DELETE, GET, PATCH, POST, PUT } from '@/app/api/v1/groups/[groupId]/members/route';
import orchestrator from '../../../../../../orchestrator';

beforeEach(async () => {
  await orchestrator.clearDatabase();
});

function getMembers(groupId, cookie) {
  return GET(
    new Request(`http://localhost/api/v1/groups/${groupId}/members`, {
      headers: cookie ? { cookie } : {},
    }),
    { params: Promise.resolve({ groupId }) },
  );
}

describe('GET /api/v1/groups/[groupId]/members', () => {
  test('retorna 200 com a lista de membros e papéis sem dados sensíveis', async () => {
    const owner = await orchestrator.createUser({ name: 'Ana', username: 'ana' });
    const admin = await orchestrator.createUser({ name: 'Beto', username: 'beto' });
    const member = await orchestrator.createUser({ name: 'Carla', username: 'carla' });
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, admin, 'ADMIN');
    await orchestrator.addMember(group, member, 'MEMBER');

    const { cookie } = await orchestrator.createSession(member);
    const response = await getMembers(group.id, cookie);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual([
      {
        userId: owner.id,
        username: 'ana',
        name: 'Ana',
        role: 'OWNER',
        joinedAt: expect.any(String),
      },
      {
        userId: admin.id,
        username: 'beto',
        name: 'Beto',
        role: 'ADMIN',
        joinedAt: expect.any(String),
      },
      {
        userId: member.id,
        username: 'carla',
        name: 'Carla',
        role: 'MEMBER',
        joinedAt: expect.any(String),
      },
    ]);
    for (const item of body) {
      expect(item).not.toHaveProperty('email');
      expect(item).not.toHaveProperty('passwordHash');
    }
  });

  test('retorna 404 para não membro', async () => {
    const owner = await orchestrator.createUser();
    const outsider = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const { cookie } = await orchestrator.createSession(outsider);

    const response = await getMembers(group.id, cookie);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      name: 'NotFoundError',
      message: 'Grupo não encontrado.',
      action: 'Verifique se você ainda participa deste grupo.',
      statusCode: 404,
    });
  });

  test('retorna 401 sem autenticação', async () => {
    const response = await getMembers('00000000-0000-0000-0000-000000000000');
    expect(response.status).toBe(401);
  });

  test.each([
    ['POST', POST],
    ['PUT', PUT],
    ['PATCH', PATCH],
    ['DELETE', DELETE],
  ])('%s retorna 405', async (method, handler) => {
    const response = await handler(
      new Request('http://localhost/api/v1/groups/x/members', { method }),
      { params: Promise.resolve({ groupId: 'x' }) },
    );
    expect(response.status).toBe(405);
  });
});
