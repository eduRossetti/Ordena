import { DELETE, GET, PATCH, POST, PUT } from '@/app/api/v1/user/invites/route';
import orchestrator from '../../../../../orchestrator';

beforeEach(async () => {
  await orchestrator.clearDatabase();
});

function getUserInvites(cookie) {
  return GET(
    new Request('http://localhost/api/v1/user/invites', {
      headers: cookie ? { cookie } : {},
    }),
    {},
  );
}

describe('GET /api/v1/user/invites', () => {
  test('retorna 200 apenas com os convites PENDING recebidos pelo usuário autenticado', async () => {
    const owner = await orchestrator.createUser();
    const invited = await orchestrator.createUser();
    const other = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner, { name: 'Equipe' });

    const pending = await orchestrator.createInvite(group, invited, owner);
    await orchestrator.createInvite(group, invited, owner, { status: 'CANCELED' });
    await orchestrator.createInvite(group, other, owner);

    const { cookie } = await orchestrator.createSession(invited);
    const response = await getUserInvites(cookie);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        id: pending.id,
        groupId: group.id,
        groupName: 'Equipe',
        status: 'PENDING',
        invitedUser: { id: invited.id, username: invited.username, name: invited.name },
        invitedBy: { id: owner.id, username: owner.username, name: owner.name },
        createdAt: expect.any(String),
        respondedAt: null,
      },
    ]);
  });

  test('retorna 401 sem autenticação', async () => {
    const response = await getUserInvites();
    expect(response.status).toBe(401);
  });

  test.each([
    ['POST', POST],
    ['PUT', PUT],
    ['PATCH', PATCH],
    ['DELETE', DELETE],
  ])('%s retorna 405', async (method, handler) => {
    const response = await handler(
      new Request('http://localhost/api/v1/user/invites', { method }),
      {},
    );
    expect(response.status).toBe(405);
  });
});
