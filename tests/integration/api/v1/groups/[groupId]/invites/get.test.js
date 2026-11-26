import { DELETE, GET, PATCH, PUT } from '@/app/api/v1/groups/[groupId]/invites/route';
import orchestrator from '../../../../../../orchestrator';

beforeEach(async () => {
  await orchestrator.clearDatabase();
});

function getInvites(groupId, cookie) {
  return GET(
    new Request(`http://localhost/api/v1/groups/${groupId}/invites`, {
      headers: cookie ? { cookie } : {},
    }),
    { params: Promise.resolve({ groupId }) },
  );
}

describe('GET /api/v1/groups/[groupId]/invites', () => {
  test('retorna 200 com apenas os convites PENDING do grupo para OWNER e ADMIN', async () => {
    const owner = await orchestrator.createUser();
    const admin = await orchestrator.createUser();
    const target1 = await orchestrator.createUser();
    const target2 = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner, { name: 'Casa' });
    await orchestrator.addMember(group, admin, 'ADMIN');

    const pending = await orchestrator.createInvite(group, target1, owner);
    await orchestrator.createInvite(group, target2, owner, { status: 'DECLINED' });

    for (const actor of [owner, admin]) {
      const { cookie } = await orchestrator.createSession(actor);
      const response = await getInvites(group.id, cookie);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([
        {
          id: pending.id,
          groupId: group.id,
          groupName: 'Casa',
          status: 'PENDING',
          invitedUser: { id: target1.id, username: target1.username, name: target1.name },
          invitedBy: { id: owner.id, username: owner.username, name: owner.name },
          createdAt: expect.any(String),
          respondedAt: null,
        },
      ]);
    }
  });

  test('retorna 403 para MEMBER', async () => {
    const owner = await orchestrator.createUser();
    const member = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, member, 'MEMBER');
    const { cookie } = await orchestrator.createSession(member);

    const response = await getInvites(group.id, cookie);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      name: 'ForbiddenError',
      message: 'Apenas o dono e os administradores podem fazer isso.',
      action: 'Peça a um administrador do grupo.',
      statusCode: 403,
    });
  });

  test('retorna 404 para não membro', async () => {
    const owner = await orchestrator.createUser();
    const outsider = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const { cookie } = await orchestrator.createSession(outsider);

    const response = await getInvites(group.id, cookie);
    expect(response.status).toBe(404);
  });

  test('retorna 401 sem autenticação', async () => {
    const response = await getInvites('00000000-0000-0000-0000-000000000000');
    expect(response.status).toBe(401);
  });

  test.each([
    ['PUT', PUT],
    ['PATCH', PATCH],
    ['DELETE', DELETE],
  ])('%s retorna 405', async (method, handler) => {
    const response = await handler(
      new Request('http://localhost/api/v1/groups/x/invites', { method }),
      { params: Promise.resolve({ groupId: 'x' }) },
    );
    expect(response.status).toBe(405);
  });
});
