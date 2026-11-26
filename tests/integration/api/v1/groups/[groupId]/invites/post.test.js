import { POST } from '@/app/api/v1/groups/[groupId]/invites/route';
import orchestrator from '../../../../../../orchestrator';

beforeEach(async () => {
  await orchestrator.clearDatabase();
});

function postInvite(groupId, body, cookie) {
  return POST(
    new Request(`http://localhost/api/v1/groups/${groupId}/invites`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ groupId }) },
  );
}

describe('POST /api/v1/groups/[groupId]/invites', () => {
  test('retorna 201 quando OWNER ou ADMIN convida por username (inclusive quem tem outro grupo)', async () => {
    const owner = await orchestrator.createUser();
    const admin = await orchestrator.createUser();
    const target1 = await orchestrator.createUser({ username: 'maria_s' });
    const target2 = await orchestrator.createUser({ username: 'joao_p' });
    const group = await orchestrator.createGroup(owner, { name: 'Casa' });
    await orchestrator.addMember(group, admin, 'ADMIN');
    await orchestrator.createGroup(target2, { name: 'Outro Grupo' });

    const ownerSession = await orchestrator.createSession(owner);
    const res1 = await postInvite(group.id, { username: '  MARIA_S  ' }, ownerSession.cookie);
    expect(res1.status).toBe(201);
    expect(await res1.json()).toEqual({
      id: expect.any(String),
      groupId: group.id,
      groupName: 'Casa',
      status: 'PENDING',
      invitedUser: { id: target1.id, username: target1.username, name: target1.name },
      invitedBy: { id: owner.id, username: owner.username, name: owner.name },
      createdAt: expect.any(String),
      respondedAt: null,
    });

    const adminSession = await orchestrator.createSession(admin);
    const res2 = await postInvite(group.id, { username: 'joao_p' }, adminSession.cookie);
    expect(res2.status).toBe(201);
    expect((await res2.json()).invitedUser.id).toBe(target2.id);
  });

  test('permite novo convite quando o anterior foi recusado ou cancelado', async () => {
    const owner = await orchestrator.createUser();
    const target = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.createInvite(group, target, owner, { status: 'DECLINED' });
    await orchestrator.createInvite(group, target, owner, { status: 'CANCELED' });

    const { cookie } = await orchestrator.createSession(owner);
    const response = await postInvite(group.id, { username: target.username }, cookie);
    expect(response.status).toBe(201);
  });

  test('retorna 403 quando MEMBER tenta convidar', async () => {
    const owner = await orchestrator.createUser();
    const member = await orchestrator.createUser();
    const target = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, member, 'MEMBER');
    const { cookie } = await orchestrator.createSession(member);

    const response = await postInvite(group.id, { username: target.username }, cookie);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      name: 'ForbiddenError',
      message: 'Apenas o dono e os administradores podem fazer isso.',
      action: 'Peça a um administrador do grupo.',
      statusCode: 403,
    });
  });

  test('retorna 404 quando username não existe', async () => {
    const owner = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const { cookie } = await orchestrator.createSession(owner);

    const response = await postInvite(group.id, { username: 'nao_existe' }, cookie);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      name: 'NotFoundError',
      message: 'Usuário não encontrado.',
      action: 'Confira o username.',
      statusCode: 404,
    });
  });

  test('retorna 409 quando o usuário já participa deste grupo', async () => {
    const owner = await orchestrator.createUser();
    const member = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, member, 'MEMBER');
    const { cookie } = await orchestrator.createSession(owner);

    const response = await postInvite(group.id, { username: member.username }, cookie);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      name: 'ConflictError',
      message: 'Esta pessoa já participa do grupo.',
      statusCode: 409,
    });
  });

  test('retorna 409 quando já existe convite pendente para esta pessoa', async () => {
    const owner = await orchestrator.createUser();
    const target = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.createInvite(group, target, owner);
    const { cookie } = await orchestrator.createSession(owner);

    const response = await postInvite(group.id, { username: target.username }, cookie);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      name: 'ConflictError',
      message: 'Já existe um convite pendente para esta pessoa.',
      statusCode: 409,
    });
  });

  test('retorna 404 para não membro do grupo', async () => {
    const owner = await orchestrator.createUser();
    const outsider = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const { cookie } = await orchestrator.createSession(outsider);

    const response = await postInvite(group.id, { username: owner.username }, cookie);
    expect(response.status).toBe(404);
    expect((await response.json()).message).toBe('Grupo não encontrado.');
  });

  test('retorna 400 quando username está ausente ou vazio', async () => {
    const owner = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const { cookie } = await orchestrator.createSession(owner);

    const response = await postInvite(group.id, { username: '   ' }, cookie);
    expect(response.status).toBe(400);
    expect((await response.json()).name).toBe('ValidationError');
  });

  test('retorna 401 sem autenticação', async () => {
    const response = await postInvite('00000000-0000-0000-0000-000000000000', { username: 'x' });
    expect(response.status).toBe(401);
  });

  test('banco garante no máximo 1 convite PENDING por pessoa + grupo', async () => {
    const owner = await orchestrator.createUser();
    const target = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);

    await orchestrator.createInvite(group, target, owner);
    await expect(orchestrator.createInvite(group, target, owner)).rejects.toMatchObject({
      code: 'P2002',
    });
  });
});
