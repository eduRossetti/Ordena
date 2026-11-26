import { DELETE, GET, PATCH, POST, PUT } from '@/app/api/v1/invites/[inviteId]/route';
import { DELETE as DELETE_MEMBER } from '@/app/api/v1/groups/[groupId]/members/[userId]/route';
import { prisma } from 'infra/database';
import orchestrator from '../../../../../orchestrator';

beforeEach(async () => {
  await orchestrator.clearDatabase();
});

function patchInvite(inviteId, body, cookie) {
  return PATCH(
    new Request(`http://localhost/api/v1/invites/${inviteId}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ inviteId }) },
  );
}

function deleteMember(groupId, userId, cookie) {
  return DELETE_MEMBER(
    new Request(`http://localhost/api/v1/groups/${groupId}/members/${userId}`, {
      method: 'DELETE',
      headers: { cookie },
    }),
    { params: Promise.resolve({ groupId, userId }) },
  );
}

describe('PATCH /api/v1/invites/[inviteId]', () => {
  test('retorna 200 ao aceitar convite estando sem grupo: cria vínculo MEMBER e devolve membership novo', async () => {
    const owner = await orchestrator.createUser();
    const invited = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner, { name: 'Casa' });
    const invite = await orchestrator.createInvite(group, invited, owner);
    const { cookie } = await orchestrator.createSession(invited);

    const response = await patchInvite(invite.id, { status: 'ACCEPTED' }, cookie);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: invite.id,
      groupId: group.id,
      groupName: 'Casa',
      status: 'ACCEPTED',
      invitedUser: { id: invited.id, username: invited.username, name: invited.name },
      invitedBy: { id: owner.id, username: owner.username, name: owner.name },
      createdAt: expect.any(String),
      respondedAt: expect.any(String),
      membership: {
        groupId: group.id,
        groupName: 'Casa',
        role: 'MEMBER',
      },
    });

    const membership = await prisma.groupMember.findUnique({ where: { userId: invited.id } });
    expect(membership).toMatchObject({ groupId: group.id, role: 'MEMBER' });
  });

  test('ao aceitar estando em outro grupo como MEMBER/ADMIN, sai do antigo (limpa task_assignees) e entra no novo', async () => {
    const ownerOld = await orchestrator.createUser();
    const ownerNew = await orchestrator.createUser();
    const invited = await orchestrator.createUser();
    const oldGroup = await orchestrator.createGroup(ownerOld, { name: 'Antigo' });
    const newGroup = await orchestrator.createGroup(ownerNew, { name: 'Novo' });
    await orchestrator.addMember(oldGroup, invited, 'ADMIN');
    const oldTask = await orchestrator.createTask(oldGroup, invited, {
      assigneeIds: [ownerOld.id, invited.id],
    });

    const invite = await orchestrator.createInvite(newGroup, invited, ownerNew);
    const { cookie } = await orchestrator.createSession(invited);

    const response = await patchInvite(invite.id, { status: 'ACCEPTED' }, cookie);
    expect(response.status).toBe(200);
    expect((await response.json()).membership).toEqual({
      groupId: newGroup.id,
      groupName: 'Novo',
      role: 'MEMBER',
    });

    expect(await prisma.group.findUnique({ where: { id: oldGroup.id } })).not.toBeNull();
    const membership = await prisma.groupMember.findUnique({ where: { userId: invited.id } });
    expect(membership).toMatchObject({ groupId: newGroup.id, role: 'MEMBER' });
    const remainingAssignees = await prisma.taskAssignee.findMany({
      where: { taskId: oldTask.id },
    });
    expect(remainingAssignees.map((a) => a.userId)).toEqual([ownerOld.id]);
  });

  test('ao aceitar sendo OWNER sozinho de outro grupo, apaga o grupo antigo e entra no novo', async () => {
    const ownerNew = await orchestrator.createUser();
    const soloOwner = await orchestrator.createUser();
    const oldGroup = await orchestrator.createGroup(soloOwner, { name: 'Solo' });
    const newGroup = await orchestrator.createGroup(ownerNew, { name: 'Novo' });
    const invite = await orchestrator.createInvite(newGroup, soloOwner, ownerNew);
    const { cookie } = await orchestrator.createSession(soloOwner);

    const response = await patchInvite(invite.id, { status: 'ACCEPTED' }, cookie);
    expect(response.status).toBe(200);
    expect(await prisma.group.findUnique({ where: { id: oldGroup.id } })).toBeNull();
    const membership = await prisma.groupMember.findUnique({ where: { userId: soloOwner.id } });
    expect(membership).toMatchObject({ groupId: newGroup.id, role: 'MEMBER' });
  });

  test('retorna 409 ao aceitar sendo OWNER de outro grupo com membros', async () => {
    const ownerNew = await orchestrator.createUser();
    const ownerOld = await orchestrator.createUser();
    const otherMember = await orchestrator.createUser();
    const oldGroup = await orchestrator.createGroup(ownerOld, { name: 'Antigo' });
    await orchestrator.addMember(oldGroup, otherMember, 'MEMBER');
    const newGroup = await orchestrator.createGroup(ownerNew, { name: 'Novo' });

    const invite = await orchestrator.createInvite(newGroup, ownerOld, ownerNew);
    const { cookie } = await orchestrator.createSession(ownerOld);

    const response = await patchInvite(invite.id, { status: 'ACCEPTED' }, cookie);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      name: 'ConflictError',
      message: 'Você é o dono deste grupo.',
      action: 'Transfira a posse para outro membro antes de sair.',
      statusCode: 409,
    });

    // Convite continua PENDING
    const unchanged = await prisma.groupInvite.findUnique({ where: { id: invite.id } });
    expect(unchanged.status).toBe('PENDING');
  });

  test('retorna 200 ao recusar convite e não altera membership', async () => {
    const owner = await orchestrator.createUser();
    const invited = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner, { name: 'Casa' });
    const invite = await orchestrator.createInvite(group, invited, owner);
    const { cookie } = await orchestrator.createSession(invited);

    const response = await patchInvite(invite.id, { status: 'DECLINED' }, cookie);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      id: invite.id,
      status: 'DECLINED',
      respondedAt: expect.any(String),
    });
    expect(await prisma.groupMember.findUnique({ where: { userId: invited.id } })).toBeNull();
  });

  test('retorna 404 ao tentar responder convite de terceiros ou inexistente', async () => {
    const owner = await orchestrator.createUser();
    const invited = await orchestrator.createUser();
    const intruder = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const invite = await orchestrator.createInvite(group, invited, owner);
    const { cookie } = await orchestrator.createSession(intruder);

    const response = await patchInvite(invite.id, { status: 'ACCEPTED' }, cookie);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      name: 'NotFoundError',
      message: 'Convite não encontrado.',
      statusCode: 404,
    });
  });

  test('retorna 409 ao responder convite que não está PENDING', async () => {
    const owner = await orchestrator.createUser();
    const invited = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const invite = await orchestrator.createInvite(group, invited, owner, { status: 'CANCELED' });
    const { cookie } = await orchestrator.createSession(invited);

    const response = await patchInvite(invite.id, { status: 'ACCEPTED' }, cookie);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      name: 'ConflictError',
      message: 'Este convite já foi respondido ou cancelado.',
      statusCode: 409,
    });
  });

  test('retorna 400 para status inválido', async () => {
    const owner = await orchestrator.createUser();
    const invited = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const invite = await orchestrator.createInvite(group, invited, owner);
    const { cookie } = await orchestrator.createSession(invited);

    const response = await patchInvite(invite.id, { status: 'CANCELED' }, cookie);
    expect(response.status).toBe(400);
    expect((await response.json()).name).toBe('ValidationError');
  });

  test('dono sozinho sai enquanto o convidado aceita: ninguém fica sem grupo com convite ACCEPTED e nada dá 500', async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const owner = await orchestrator.createUser();
      const invited = await orchestrator.createUser();
      const group = await orchestrator.createGroup(owner);
      const invite = await orchestrator.createInvite(group, invited, owner);
      const ownerSession = await orchestrator.createSession(owner);
      const invitedSession = await orchestrator.createSession(invited);

      const [leaveResponse, acceptResponse] = await Promise.all([
        deleteMember(group.id, owner.id, ownerSession.cookie),
        patchInvite(invite.id, { status: 'ACCEPTED' }, invitedSession.cookie),
      ]);

      const groupStillExists = await prisma.group.findUnique({ where: { id: group.id } });
      const invitedMembership = await prisma.groupMember.findUnique({
        where: { userId: invited.id },
      });

      if (acceptResponse.status === 200) {
        // Aceite venceu: o dono deixou de estar sozinho e não pode mais sair.
        expect(leaveResponse.status).toBe(409);
        expect(groupStillExists).not.toBeNull();
        expect(invitedMembership).toMatchObject({ groupId: group.id, role: 'MEMBER' });
      } else {
        // Saída venceu: grupo (e convite) somem; o aceite responde 404.
        expect(leaveResponse.status).toBe(204);
        expect(acceptResponse.status).toBe(404);
        expect((await acceptResponse.json()).message).toBe('Convite não encontrado.');
        expect(groupStillExists).toBeNull();
        expect(invitedMembership).toBeNull();
      }
    }
  });

  test('retorna 401 sem autenticação', async () => {
    const response = await patchInvite('00000000-0000-0000-0000-000000000000', {
      status: 'ACCEPTED',
    });
    expect(response.status).toBe(401);
  });

  test.each([
    ['GET', GET],
    ['POST', POST],
    ['PUT', PUT],
    ['DELETE', DELETE],
  ])('%s retorna 405', async (method, handler) => {
    const response = await handler(new Request('http://localhost/api/v1/invites/x', { method }), {
      params: Promise.resolve({ inviteId: 'x' }),
    });
    expect(response.status).toBe(405);
  });
});
