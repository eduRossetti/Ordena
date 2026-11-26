import { DELETE } from '@/app/api/v1/groups/[groupId]/route';
import { GET as GET_USER } from '@/app/api/v1/user/route';
import { prisma } from 'infra/database';
import orchestrator from '../../../../../orchestrator';

beforeEach(async () => {
  await orchestrator.clearDatabase();
});

function deleteGroup(groupId, cookie) {
  return DELETE(
    new Request(`http://localhost/api/v1/groups/${groupId}`, {
      method: 'DELETE',
      headers: cookie ? { cookie } : {},
    }),
    { params: Promise.resolve({ groupId }) },
  );
}

describe('DELETE /api/v1/groups/[groupId]', () => {
  test('retorna 204 quando OWNER apaga o grupo e remove membros em cascade', async () => {
    const owner = await orchestrator.createUser();
    const member = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, member, 'MEMBER');
    const { cookie } = await orchestrator.createSession(owner);

    const response = await deleteGroup(group.id, cookie);
    expect(response.status).toBe(204);

    expect(await prisma.group.findUnique({ where: { id: group.id } })).toBeNull();
    expect(await prisma.groupMember.findMany({ where: { groupId: group.id } })).toEqual([]);

    const userRes = await GET_USER(
      new Request('http://localhost/api/v1/user', { headers: { cookie } }),
      {},
    );
    expect((await userRes.json()).membership).toBeNull();
  });

  test('retorna 403 quando ADMIN ou MEMBER tenta apagar o grupo', async () => {
    const owner = await orchestrator.createUser();
    const admin = await orchestrator.createUser();
    const member = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, admin, 'ADMIN');
    await orchestrator.addMember(group, member, 'MEMBER');

    for (const u of [admin, member]) {
      const { cookie } = await orchestrator.createSession(u);
      const response = await deleteGroup(group.id, cookie);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        name: 'ForbiddenError',
        message: 'Apenas o dono do grupo pode fazer isso.',
        action: 'Peça ao dono do grupo.',
        statusCode: 403,
      });
    }
  });

  test('retorna 404 para não membro', async () => {
    const owner = await orchestrator.createUser();
    const outsider = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const { cookie } = await orchestrator.createSession(outsider);

    const response = await deleteGroup(group.id, cookie);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      name: 'NotFoundError',
      message: 'Grupo não encontrado.',
      action: 'Verifique se você ainda participa deste grupo.',
      statusCode: 404,
    });
  });

  test('retorna 401 sem autenticação', async () => {
    const response = await deleteGroup('00000000-0000-0000-0000-000000000000');
    expect(response.status).toBe(401);
  });
});
