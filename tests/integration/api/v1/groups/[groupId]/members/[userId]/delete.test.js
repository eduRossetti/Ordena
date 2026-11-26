import { DELETE } from '@/app/api/v1/groups/[groupId]/members/[userId]/route';
import { GET as GET_USER } from '@/app/api/v1/user/route';
import { prisma } from 'infra/database';
import orchestrator from '../../../../../../../orchestrator';

beforeEach(async () => {
  await orchestrator.clearDatabase();
});

function deleteMember(groupId, userId, cookie) {
  return DELETE(
    new Request(`http://localhost/api/v1/groups/${groupId}/members/${userId}`, {
      method: 'DELETE',
      headers: cookie ? { cookie } : {},
    }),
    { params: Promise.resolve({ groupId, userId }) },
  );
}

describe('DELETE /api/v1/groups/[groupId]/members/[userId]', () => {
  test('retorna 204 quando MEMBER ou ADMIN sai do grupo', async () => {
    const owner = await orchestrator.createUser();
    const admin = await orchestrator.createUser();
    const member = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, admin, 'ADMIN');
    await orchestrator.addMember(group, member, 'MEMBER');

    const memberSession = await orchestrator.createSession(member);
    const resMember = await deleteMember(group.id, member.id, memberSession.cookie);
    expect(resMember.status).toBe(204);
    expect(await prisma.groupMember.findUnique({ where: { userId: member.id } })).toBeNull();

    const adminSession = await orchestrator.createSession(admin);
    const resAdmin = await deleteMember(group.id, admin.id, adminSession.cookie);
    expect(resAdmin.status).toBe(204);
    expect(await prisma.groupMember.findUnique({ where: { userId: admin.id } })).toBeNull();
  });

  test('retorna 409 quando OWNER tenta sair havendo outros membros', async () => {
    const owner = await orchestrator.createUser();
    const member = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, member, 'MEMBER');
    const { cookie } = await orchestrator.createSession(owner);

    const response = await deleteMember(group.id, owner.id, cookie);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      name: 'ConflictError',
      message: 'Você é o dono deste grupo.',
      action: 'Transfira a posse para outro membro antes de sair.',
      statusCode: 409,
    });
  });

  test('retorna 204 quando OWNER sai sendo o único membro e apaga o grupo', async () => {
    const owner = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const { cookie } = await orchestrator.createSession(owner);

    const response = await deleteMember(group.id, owner.id, cookie);
    expect(response.status).toBe(204);
    expect(await prisma.group.findUnique({ where: { id: group.id } })).toBeNull();

    const userRes = await GET_USER(
      new Request('http://localhost/api/v1/user', { headers: { cookie } }),
      {},
    );
    expect((await userRes.json()).membership).toBeNull();
  });

  test('retorna 204 quando OWNER remove MEMBER ou ADMIN, e quando ADMIN remove MEMBER', async () => {
    const owner = await orchestrator.createUser();
    const admin = await orchestrator.createUser();
    const member1 = await orchestrator.createUser();
    const member2 = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, admin, 'ADMIN');
    await orchestrator.addMember(group, member1, 'MEMBER');
    await orchestrator.addMember(group, member2, 'MEMBER');

    const adminSession = await orchestrator.createSession(admin);
    const res1 = await deleteMember(group.id, member1.id, adminSession.cookie);
    expect(res1.status).toBe(204);

    const ownerSession = await orchestrator.createSession(owner);
    const res2 = await deleteMember(group.id, member2.id, ownerSession.cookie);
    expect(res2.status).toBe(204);

    const res3 = await deleteMember(group.id, admin.id, ownerSession.cookie);
    expect(res3.status).toBe(204);
  });

  test('retorna 403 quando ADMIN tenta remover ADMIN ou OWNER', async () => {
    const owner = await orchestrator.createUser();
    const admin1 = await orchestrator.createUser();
    const admin2 = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, admin1, 'ADMIN');
    await orchestrator.addMember(group, admin2, 'ADMIN');
    const { cookie } = await orchestrator.createSession(admin1);

    const removeAdmin = await deleteMember(group.id, admin2.id, cookie);
    expect(removeAdmin.status).toBe(403);
    expect(await removeAdmin.json()).toEqual({
      name: 'ForbiddenError',
      message: 'Apenas o dono do grupo pode fazer isso.',
      action: 'Peça ao dono do grupo.',
      statusCode: 403,
    });

    const removeOwner = await deleteMember(group.id, owner.id, cookie);
    expect(removeOwner.status).toBe(403);
    expect(await removeOwner.json()).toEqual({
      name: 'ForbiddenError',
      message: 'Apenas o dono do grupo pode fazer isso.',
      action: 'Peça ao dono do grupo.',
      statusCode: 403,
    });
  });

  test('retorna 403 quando MEMBER tenta remover outro membro', async () => {
    const owner = await orchestrator.createUser();
    const member1 = await orchestrator.createUser();
    const member2 = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, member1, 'MEMBER');
    await orchestrator.addMember(group, member2, 'MEMBER');
    const { cookie } = await orchestrator.createSession(member1);

    const response = await deleteMember(group.id, member2.id, cookie);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      name: 'ForbiddenError',
      message: 'Apenas o dono e os administradores podem fazer isso.',
      action: 'Peça a um administrador do grupo.',
      statusCode: 403,
    });
  });

  test('retorna 404 quando alvo ou ator não pertence ao grupo', async () => {
    const owner = await orchestrator.createUser();
    const outsider = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);

    const ownerSession = await orchestrator.createSession(owner);
    const missingTarget = await deleteMember(group.id, outsider.id, ownerSession.cookie);
    expect(missingTarget.status).toBe(404);
    expect((await missingTarget.json()).message).toBe('Membro não encontrado.');

    const outsiderSession = await orchestrator.createSession(outsider);
    const notMember = await deleteMember(group.id, owner.id, outsiderSession.cookie);
    expect(notMember.status).toBe(404);
    expect((await notMember.json()).message).toBe('Grupo não encontrado.');
  });

  test('retorna 401 sem autenticação', async () => {
    const response = await deleteMember(
      '00000000-0000-0000-0000-000000000000',
      '00000000-0000-0000-0000-000000000001',
    );
    expect(response.status).toBe(401);
  });

  test('sair ou ser removido apaga os task_assignees do usuário no grupo e mantém tarefas criadas por ele', async () => {
    const owner = await orchestrator.createUser();
    const member1 = await orchestrator.createUser();
    const member2 = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, member1, 'MEMBER');
    await orchestrator.addMember(group, member2, 'MEMBER');

    const taskByMember1 = await orchestrator.createTask(group, member1, {
      assigneeIds: [owner.id, member1.id, member2.id],
    });

    // member1 sai
    const member1Session = await orchestrator.createSession(member1);
    expect((await deleteMember(group.id, member1.id, member1Session.cookie)).status).toBe(204);

    // owner remove member2
    const ownerSession = await orchestrator.createSession(owner);
    expect((await deleteMember(group.id, member2.id, ownerSession.cookie)).status).toBe(204);

    // Tarefa criada por member1 permanece; só owner continua atribuído
    expect(await prisma.task.findUnique({ where: { id: taskByMember1.id } })).not.toBeNull();
    const remainingAssignees = await prisma.taskAssignee.findMany({
      where: { taskId: taskByMember1.id },
    });
    expect(remainingAssignees.map((a) => a.userId)).toEqual([owner.id]);
  });
});
