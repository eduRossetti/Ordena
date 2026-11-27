import { GET, PATCH, POST, PUT } from '@/app/api/v1/groups/[groupId]/members/[userId]/route';
import orchestrator from '../../../../../../../orchestrator';

beforeEach(async () => {
  await orchestrator.clearDatabase();
});

function patchMember(groupId, userId, body, cookie) {
  return PATCH(
    new Request(`http://localhost/api/v1/groups/${groupId}/members/${userId}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ groupId, userId }) },
  );
}

describe('PATCH /api/v1/groups/[groupId]/members/[userId]', () => {
  test('retorna 200 quando OWNER promove MEMBER para ADMIN e rebaixa ADMIN para MEMBER', async () => {
    const owner = await orchestrator.createUser();
    const member = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, member, 'MEMBER');
    const { cookie } = await orchestrator.createSession(owner);

    const promote = await patchMember(group.id, member.id, { role: 'ADMIN' }, cookie);
    expect(promote.status).toBe(200);
    expect(await promote.json()).toEqual({
      userId: member.id,
      username: member.username,
      name: member.name,
      role: 'ADMIN',
      joinedAt: expect.any(String),
    });

    const demote = await patchMember(group.id, member.id, { role: 'MEMBER' }, cookie);
    expect(demote.status).toBe(200);
    expect((await demote.json()).role).toBe('MEMBER');
  });

  test('retorna 403 quando ADMIN ou MEMBER tenta mudar papel', async () => {
    const owner = await orchestrator.createUser();
    const admin = await orchestrator.createUser();
    const member = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, admin, 'ADMIN');
    await orchestrator.addMember(group, member, 'MEMBER');

    for (const actor of [admin, member]) {
      const { cookie } = await orchestrator.createSession(actor);
      const response = await patchMember(group.id, member.id, { role: 'ADMIN' }, cookie);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        name: 'ForbiddenError',
        message: 'Apenas o dono do grupo pode fazer isso.',
        action: 'Peça ao dono do grupo.',
        statusCode: 403,
      });
    }
  });

  test('retorna 400 ao tentar mudar o papel do OWNER ou promover alguém para OWNER', async () => {
    const owner = await orchestrator.createUser();
    const member = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, member, 'MEMBER');
    const { cookie } = await orchestrator.createSession(owner);

    const changeOwner = await patchMember(group.id, owner.id, { role: 'ADMIN' }, cookie);
    expect(changeOwner.status).toBe(400);
    expect(await changeOwner.json()).toEqual({
      name: 'ValidationError',
      message: 'A posse só muda por transferência.',
      action: 'Use a transferência de posse.',
      statusCode: 400,
    });

    const promoteToOwner = await patchMember(group.id, member.id, { role: 'OWNER' }, cookie);
    expect(promoteToOwner.status).toBe(400);
    expect(await promoteToOwner.json()).toEqual({
      name: 'ValidationError',
      message: 'A posse só muda por transferência.',
      action: 'Use a transferência de posse.',
      statusCode: 400,
    });
  });

  test('retorna 400 quando papel é inválido', async () => {
    const owner = await orchestrator.createUser();
    const member = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, member, 'MEMBER');
    const { cookie } = await orchestrator.createSession(owner);

    const response = await patchMember(group.id, member.id, { role: 'SUPERADMIN' }, cookie);
    expect(response.status).toBe(400);
    expect((await response.json()).name).toBe('ValidationError');
  });

  test('retorna 404 quando alvo não é membro do grupo', async () => {
    const owner = await orchestrator.createUser();
    const outsider = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const { cookie } = await orchestrator.createSession(owner);

    const response = await patchMember(group.id, outsider.id, { role: 'ADMIN' }, cookie);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      name: 'NotFoundError',
      message: 'Membro não encontrado.',
      statusCode: 404,
    });
  });

  test('retorna 404 quando ator não é membro do grupo', async () => {
    const owner = await orchestrator.createUser();
    const outsider = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const { cookie } = await orchestrator.createSession(outsider);

    const response = await patchMember(group.id, owner.id, { role: 'MEMBER' }, cookie);
    expect(response.status).toBe(404);
    expect((await response.json()).message).toBe('Grupo não encontrado.');
  });

  test('retorna 401 sem autenticação', async () => {
    const response = await patchMember(
      '00000000-0000-0000-0000-000000000000',
      '00000000-0000-0000-0000-000000000001',
      { role: 'ADMIN' },
    );
    expect(response.status).toBe(401);
  });

  test.each([
    ['GET', GET],
    ['POST', POST],
    ['PUT', PUT],
  ])('%s retorna 405', async (method, handler) => {
    const response = await handler(
      new Request('http://localhost/api/v1/groups/x/members/y', { method }),
      { params: Promise.resolve({ groupId: 'x', userId: 'y' }) },
    );
    expect(response.status).toBe(405);
  });
});
