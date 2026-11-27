import { POST } from '@/app/api/v1/groups/[groupId]/tasks/route';
import orchestrator from '../../../../../../orchestrator';

beforeEach(async () => {
  await orchestrator.clearDatabase();
});

function postTask(groupId, body, cookie) {
  return POST(
    new Request(`http://localhost/api/v1/groups/${groupId}/tasks`, {
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

describe('POST /api/v1/groups/[groupId]/tasks', () => {
  test('retorna 201 quando qualquer membro cria tarefa com defaults', async () => {
    const owner = await orchestrator.createUser();
    const member = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, member, 'MEMBER');
    const { cookie } = await orchestrator.createSession(member);

    const response = await postTask(group.id, { title: 'Lavar a louça' }, cookie);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: expect.any(String),
      groupId: group.id,
      title: 'Lavar a louça',
      description: null,
      status: 'TODO',
      priority: 'MEDIUM',
      dueDate: null,
      createdBy: { id: member.id, username: member.username, name: member.name },
      assignees: [],
      completedAt: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  test('cria tarefa completa com múltiplos assignees e preenche completedAt quando status é DONE', async () => {
    const owner = await orchestrator.createUser();
    const member = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, member, 'MEMBER');
    const { cookie } = await orchestrator.createSession(owner);

    const dueDate = '2026-12-31T18:00:00.000Z';
    const response = await postTask(
      group.id,
      {
        title: 'Pagar aluguel',
        description: 'Transferir até o dia 5',
        status: 'DONE',
        priority: 'HIGH',
        dueDate,
        assigneeIds: [owner.id, member.id, owner.id],
      },
      cookie,
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      title: 'Pagar aluguel',
      description: 'Transferir até o dia 5',
      status: 'DONE',
      priority: 'HIGH',
      dueDate,
      completedAt: expect.any(String),
    });
    expect(body.assignees).toHaveLength(2);
    expect(body.assignees.map((a) => a.userId).sort()).toEqual([owner.id, member.id].sort());
  });

  test('retorna 400 quando assigneeIds inclui alguém que não é membro do grupo', async () => {
    const owner = await orchestrator.createUser();
    const outsider = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const { cookie } = await orchestrator.createSession(owner);

    const response = await postTask(
      group.id,
      { title: 'Tarefa', assigneeIds: [owner.id, outsider.id] },
      cookie,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      name: 'ValidationError',
      message: 'Só é possível atribuir tarefas a membros do grupo.',
      statusCode: 400,
    });
  });

  test('retorna 400 para título vazio, prioridade ou dueDate inválida', async () => {
    const owner = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const { cookie } = await orchestrator.createSession(owner);

    const blankTitle = await postTask(group.id, { title: '   ' }, cookie);
    expect(blankTitle.status).toBe(400);

    const badPriority = await postTask(group.id, { title: 'Ok', priority: 'URGENT' }, cookie);
    expect(badPriority.status).toBe(400);

    const badDate = await postTask(group.id, { title: 'Ok', dueDate: 'nao-e-data' }, cookie);
    expect(badDate.status).toBe(400);
  });

  test('retorna 404 para não membro', async () => {
    const owner = await orchestrator.createUser();
    const outsider = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const { cookie } = await orchestrator.createSession(outsider);

    const response = await postTask(group.id, { title: 'Invasão' }, cookie);
    expect(response.status).toBe(404);
    expect((await response.json()).message).toBe('Grupo não encontrado.');
  });

  test('retorna 401 sem autenticação', async () => {
    const response = await postTask('00000000-0000-0000-0000-000000000000', { title: 'X' });
    expect(response.status).toBe(401);
  });
});
