import { GET, POST, PUT } from '@/app/api/v1/groups/[groupId]/tasks/[taskId]/route';
import { prisma } from 'infra/database';
import orchestrator from '../../../../../../../orchestrator';

beforeEach(async () => {
  await orchestrator.clearDatabase();
});

function getTask(groupId, taskId, cookie) {
  return GET(
    new Request(`http://localhost/api/v1/groups/${groupId}/tasks/${taskId}`, {
      headers: cookie ? { cookie } : {},
    }),
    { params: Promise.resolve({ groupId, taskId }) },
  );
}

describe('GET /api/v1/groups/[groupId]/tasks/[taskId]', () => {
  test('retorna 200 com detalhes da tarefa e sobrevive com createdBy null se a conta do autor for excluída', async () => {
    const owner = await orchestrator.createUser();
    const author = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, author, 'MEMBER');

    const task = await orchestrator.createTask(group, author, {
      title: 'Comprar pão',
      assigneeIds: [owner.id],
    });

    await prisma.user.delete({ where: { id: author.id } });

    const { cookie } = await orchestrator.createSession(owner);
    const response = await getTask(group.id, task.id, cookie);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: task.id,
      groupId: group.id,
      title: 'Comprar pão',
      description: null,
      status: 'TODO',
      priority: 'MEDIUM',
      dueDate: null,
      createdBy: null,
      assignees: [
        {
          userId: owner.id,
          username: owner.username,
          name: owner.name,
          assignedAt: expect.any(String),
        },
      ],
      completedAt: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  test('retorna 404 para tarefa inexistente ou de outro grupo', async () => {
    const owner1 = await orchestrator.createUser();
    const owner2 = await orchestrator.createUser();
    const group1 = await orchestrator.createGroup(owner1);
    const group2 = await orchestrator.createGroup(owner2);
    const taskFromGroup2 = await orchestrator.createTask(group2, owner2);
    const { cookie } = await orchestrator.createSession(owner1);

    const response = await getTask(group1.id, taskFromGroup2.id, cookie);
    expect(response.status).toBe(404);
    expect((await response.json()).message).toBe('Tarefa não encontrada.');
  });

  test('retorna 404 para não membro', async () => {
    const owner = await orchestrator.createUser();
    const outsider = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const task = await orchestrator.createTask(group, owner);
    const { cookie } = await orchestrator.createSession(outsider);

    const response = await getTask(group.id, task.id, cookie);
    expect(response.status).toBe(404);
    expect((await response.json()).message).toBe('Grupo não encontrado.');
  });

  test('retorna 401 sem autenticação', async () => {
    const response = await getTask(
      '00000000-0000-0000-0000-000000000000',
      '00000000-0000-0000-0000-000000000001',
    );
    expect(response.status).toBe(401);
  });

  test.each([
    ['POST', POST],
    ['PUT', PUT],
  ])('%s retorna 405', async (method, handler) => {
    const response = await handler(
      new Request('http://localhost/api/v1/groups/x/tasks/y', { method }),
      { params: Promise.resolve({ groupId: 'x', taskId: 'y' }) },
    );
    expect(response.status).toBe(405);
  });
});
