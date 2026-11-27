import { DELETE } from '@/app/api/v1/groups/[groupId]/tasks/[taskId]/route';
import { prisma } from 'infra/database';
import orchestrator from '../../../../../../../orchestrator';

beforeEach(async () => {
  await orchestrator.clearDatabase();
});

function deleteTask(groupId, taskId, cookie) {
  return DELETE(
    new Request(`http://localhost/api/v1/groups/${groupId}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: cookie ? { cookie } : {},
    }),
    { params: Promise.resolve({ groupId, taskId }) },
  );
}

describe('DELETE /api/v1/groups/[groupId]/tasks/[taskId]', () => {
  test('retorna 204 quando autor (MEMBER), ADMIN ou OWNER apaga a tarefa', async () => {
    const owner = await orchestrator.createUser();
    const admin = await orchestrator.createUser();
    const member = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, admin, 'ADMIN');
    await orchestrator.addMember(group, member, 'MEMBER');

    const t1 = await orchestrator.createTask(group, member, { assigneeIds: [owner.id] });
    const t2 = await orchestrator.createTask(group, member);
    const t3 = await orchestrator.createTask(group, admin);

    const memberSession = await orchestrator.createSession(member);
    expect((await deleteTask(group.id, t1.id, memberSession.cookie)).status).toBe(204);
    expect(await prisma.task.findUnique({ where: { id: t1.id } })).toBeNull();
    expect(await prisma.taskAssignee.findMany({ where: { taskId: t1.id } })).toEqual([]);

    const adminSession = await orchestrator.createSession(admin);
    expect((await deleteTask(group.id, t2.id, adminSession.cookie)).status).toBe(204);

    const ownerSession = await orchestrator.createSession(owner);
    expect((await deleteTask(group.id, t3.id, ownerSession.cookie)).status).toBe(204);
  });

  test('retorna 403 quando MEMBER tenta apagar tarefa de outro autor', async () => {
    const owner = await orchestrator.createUser();
    const member = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, member, 'MEMBER');
    const task = await orchestrator.createTask(group, owner);
    const { cookie } = await orchestrator.createSession(member);

    const response = await deleteTask(group.id, task.id, cookie);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      name: 'ForbiddenError',
      message: 'Você só pode editar as tarefas que criou.',
      statusCode: 403,
    });
  });

  test('retorna 404 para tarefa inexistente ou não membro', async () => {
    const owner = await orchestrator.createUser();
    const outsider = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const task = await orchestrator.createTask(group, owner);

    const ownerSession = await orchestrator.createSession(owner);
    const missing = await deleteTask(
      group.id,
      '00000000-0000-0000-0000-000000000000',
      ownerSession.cookie,
    );
    expect(missing.status).toBe(404);

    const outsiderSession = await orchestrator.createSession(outsider);
    const notMember = await deleteTask(group.id, task.id, outsiderSession.cookie);
    expect(notMember.status).toBe(404);
  });

  test('retorna 401 sem autenticação', async () => {
    const response = await deleteTask(
      '00000000-0000-0000-0000-000000000000',
      '00000000-0000-0000-0000-000000000001',
    );
    expect(response.status).toBe(401);
  });
});
