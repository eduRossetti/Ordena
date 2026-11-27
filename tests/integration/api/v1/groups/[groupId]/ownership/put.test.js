import { DELETE, GET, PATCH, POST, PUT } from '@/app/api/v1/groups/[groupId]/ownership/route';
import { prisma } from 'infra/database';
import orchestrator from '../../../../../../orchestrator';

beforeEach(async () => {
  await orchestrator.clearDatabase();
});

function putOwnership(groupId, body, cookie) {
  return PUT(
    new Request(`http://localhost/api/v1/groups/${groupId}/ownership`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ groupId }) },
  );
}

describe('PUT /api/v1/groups/[groupId]/ownership', () => {
  test('retorna 200 ao transferir posse: alvo vira OWNER e antigo dono vira ADMIN', async () => {
    const owner = await orchestrator.createUser();
    const member = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, member, 'MEMBER');
    const { cookie } = await orchestrator.createSession(owner);

    const response = await putOwnership(group.id, { userId: member.id }, cookie);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      userId: member.id,
      username: member.username,
      name: member.name,
      role: 'OWNER',
      joinedAt: expect.any(String),
    });

    const oldOwnerMembership = await prisma.groupMember.findUnique({ where: { userId: owner.id } });
    const newOwnerMembership = await prisma.groupMember.findUnique({
      where: { userId: member.id },
    });
    expect(oldOwnerMembership.role).toBe('ADMIN');
    expect(newOwnerMembership.role).toBe('OWNER');
  });

  test('retorna 403 quando ADMIN ou MEMBER tenta transferir posse', async () => {
    const owner = await orchestrator.createUser();
    const admin = await orchestrator.createUser();
    const member = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, admin, 'ADMIN');
    await orchestrator.addMember(group, member, 'MEMBER');

    for (const actor of [admin, member]) {
      const { cookie } = await orchestrator.createSession(actor);
      const response = await putOwnership(group.id, { userId: member.id }, cookie);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        name: 'ForbiddenError',
        message: 'Apenas o dono do grupo pode fazer isso.',
        action: 'Peça ao dono do grupo.',
        statusCode: 403,
      });
    }
  });

  test('retorna 404 ao transferir para quem não é membro', async () => {
    const owner = await orchestrator.createUser();
    const outsider = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const { cookie } = await orchestrator.createSession(owner);

    const response = await putOwnership(group.id, { userId: outsider.id }, cookie);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      name: 'NotFoundError',
      message: 'Membro não encontrado.',
      statusCode: 404,
    });
  });

  test('retorna 400 ao transferir para si mesmo ou com userId inválido', async () => {
    const owner = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const { cookie } = await orchestrator.createSession(owner);

    const selfTransfer = await putOwnership(group.id, { userId: owner.id }, cookie);
    expect(selfTransfer.status).toBe(400);
    expect((await selfTransfer.json()).name).toBe('ValidationError');

    const invalidId = await putOwnership(group.id, { userId: 'invalido' }, cookie);
    expect(invalidId.status).toBe(400);
    expect((await invalidId.json()).name).toBe('ValidationError');
  });

  test('retorna 404 para não membro', async () => {
    const owner = await orchestrator.createUser();
    const outsider = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const { cookie } = await orchestrator.createSession(outsider);

    const response = await putOwnership(group.id, { userId: owner.id }, cookie);
    expect(response.status).toBe(404);
    expect((await response.json()).message).toBe('Grupo não encontrado.');
  });

  test('retorna 401 sem autenticação', async () => {
    const response = await putOwnership('00000000-0000-0000-0000-000000000000', {
      userId: '00000000-0000-0000-0000-000000000001',
    });
    expect(response.status).toBe(401);
  });

  // Quem perde a corrida recebe 409 se leu o vínculo antes do commit da outra, ou 403 se leu depois
  // (já é ADMIN). O que não pode acontecer é 500 ou dois OWNERs.
  test('duas transferências ao mesmo tempo: uma retorna 200, a outra 409 ou 403, e o grupo fica com 1 OWNER', async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const owner = await orchestrator.createUser();
      const first = await orchestrator.createUser();
      const second = await orchestrator.createUser();
      const group = await orchestrator.createGroup(owner);
      await orchestrator.addMember(group, first, 'MEMBER');
      await orchestrator.addMember(group, second, 'MEMBER');
      const { cookie } = await orchestrator.createSession(owner);

      const responses = await Promise.all([
        putOwnership(group.id, { userId: first.id }, cookie),
        putOwnership(group.id, { userId: second.id }, cookie),
      ]);

      const statuses = responses.map((response) => response.status);
      expect(statuses.filter((status) => status === 200)).toHaveLength(1);

      const loser = responses.find((response) => response.status !== 200);
      expect([403, 409]).toContain(loser.status);
      if (loser.status === 409) {
        expect(await loser.json()).toEqual({
          name: 'ConflictError',
          message: 'A posse deste grupo já foi transferida.',
          action: 'Atualize a lista de membros.',
          statusCode: 409,
        });
      }

      const owners = await prisma.groupMember.count({
        where: { groupId: group.id, role: 'OWNER' },
      });
      expect(owners).toBe(1);
    }
  });

  test.each([
    ['GET', GET],
    ['POST', POST],
    ['PATCH', PATCH],
    ['DELETE', DELETE],
  ])('%s retorna 405', async (method, handler) => {
    const response = await handler(
      new Request('http://localhost/api/v1/groups/x/ownership', { method }),
      { params: Promise.resolve({ groupId: 'x' }) },
    );
    expect(response.status).toBe(405);
  });
});
