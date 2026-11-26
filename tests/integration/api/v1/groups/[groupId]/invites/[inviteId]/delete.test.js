import {
  DELETE,
  GET,
  PATCH,
  POST,
  PUT,
} from '@/app/api/v1/groups/[groupId]/invites/[inviteId]/route';
import { prisma } from 'infra/database';
import orchestrator from '../../../../../../../orchestrator';

beforeEach(async () => {
  await orchestrator.clearDatabase();
});

function deleteInvite(groupId, inviteId, cookie) {
  return DELETE(
    new Request(`http://localhost/api/v1/groups/${groupId}/invites/${inviteId}`, {
      method: 'DELETE',
      headers: cookie ? { cookie } : {},
    }),
    { params: Promise.resolve({ groupId, inviteId }) },
  );
}

describe('DELETE /api/v1/groups/[groupId]/invites/[inviteId]', () => {
  test('retorna 204 quando OWNER ou ADMIN cancela convite pendente', async () => {
    const owner = await orchestrator.createUser();
    const admin = await orchestrator.createUser();
    const target1 = await orchestrator.createUser();
    const target2 = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, admin, 'ADMIN');

    const invite1 = await orchestrator.createInvite(group, target1, owner);
    const invite2 = await orchestrator.createInvite(group, target2, owner);

    const ownerSession = await orchestrator.createSession(owner);
    const res1 = await deleteInvite(group.id, invite1.id, ownerSession.cookie);
    expect(res1.status).toBe(204);
    const canceled1 = await prisma.groupInvite.findUnique({ where: { id: invite1.id } });
    expect(canceled1.status).toBe('CANCELED');
    expect(canceled1.respondedAt).not.toBeNull();

    const adminSession = await orchestrator.createSession(admin);
    const res2 = await deleteInvite(group.id, invite2.id, adminSession.cookie);
    expect(res2.status).toBe(204);
    const canceled2 = await prisma.groupInvite.findUnique({ where: { id: invite2.id } });
    expect(canceled2.status).toBe('CANCELED');
  });

  test('retorna 403 quando MEMBER tenta cancelar convite', async () => {
    const owner = await orchestrator.createUser();
    const member = await orchestrator.createUser();
    const target = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, member, 'MEMBER');
    const invite = await orchestrator.createInvite(group, target, owner);
    const { cookie } = await orchestrator.createSession(member);

    const response = await deleteInvite(group.id, invite.id, cookie);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      name: 'ForbiddenError',
      message: 'Apenas o dono e os administradores podem fazer isso.',
      action: 'Peça a um administrador do grupo.',
      statusCode: 403,
    });
  });

  test('retorna 409 quando o convite já foi respondido ou cancelado', async () => {
    const owner = await orchestrator.createUser();
    const target = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const invite = await orchestrator.createInvite(group, target, owner, { status: 'DECLINED' });
    const { cookie } = await orchestrator.createSession(owner);

    const response = await deleteInvite(group.id, invite.id, cookie);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      name: 'ConflictError',
      message: 'Este convite já foi respondido ou cancelado.',
      statusCode: 409,
    });
  });

  test('retorna 404 quando convite não existe ou pertence a outro grupo', async () => {
    const owner1 = await orchestrator.createUser();
    const owner2 = await orchestrator.createUser();
    const target = await orchestrator.createUser();
    const group1 = await orchestrator.createGroup(owner1);
    const group2 = await orchestrator.createGroup(owner2);
    const inviteFromGroup2 = await orchestrator.createInvite(group2, target, owner2);
    const { cookie } = await orchestrator.createSession(owner1);

    const response = await deleteInvite(group1.id, inviteFromGroup2.id, cookie);
    expect(response.status).toBe(404);
    expect((await response.json()).message).toBe('Convite não encontrado.');
  });

  test('retorna 404 para não membro', async () => {
    const owner = await orchestrator.createUser();
    const outsider = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const { cookie } = await orchestrator.createSession(outsider);

    const response = await deleteInvite(group.id, '00000000-0000-0000-0000-000000000000', cookie);
    expect(response.status).toBe(404);
    expect((await response.json()).message).toBe('Grupo não encontrado.');
  });

  test('retorna 401 sem autenticação', async () => {
    const response = await deleteInvite(
      '00000000-0000-0000-0000-000000000000',
      '00000000-0000-0000-0000-000000000001',
    );
    expect(response.status).toBe(401);
  });

  test.each([
    ['GET', GET],
    ['POST', POST],
    ['PUT', PUT],
    ['PATCH', PATCH],
  ])('%s retorna 405', async (method, handler) => {
    const response = await handler(
      new Request('http://localhost/api/v1/groups/x/invites/y', { method }),
      { params: Promise.resolve({ groupId: 'x', inviteId: 'y' }) },
    );
    expect(response.status).toBe(405);
  });
});
