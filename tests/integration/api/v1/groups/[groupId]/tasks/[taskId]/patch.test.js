import { PATCH } from '@/app/api/v1/groups/[groupId]/tasks/[taskId]/route';
import orchestrator from '../../../../../../../orchestrator';

beforeEach(async () => {
  await orchestrator.clearDatabase();
});

function patchTask(groupId, taskId, body, cookie) {
  return PATCH(
    new Request(`http://localhost/api/v1/groups/${groupId}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ groupId, taskId }) },
  );
}

describe('PATCH /api/v1/groups/[groupId]/tasks/[taskId]', () => {
  test('qualquer MEMBER pode mudar apenas o status de tarefa de outro autor; DONE preenche completedAt e sair de DONE limpa', async () => {
    const owner = await orchestrator.createUser();
    const member = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, member, 'MEMBER');
    const task = await orchestrator.createTask(group, owner, { title: 'Original' });

    const { cookie } = await orchestrator.createSession(member);

    const toDone = await patchTask(group.id, task.id, { status: 'DONE' }, cookie);
    expect(toDone.status).toBe(200);
    const doneBody = await toDone.json();
    expect(doneBody.status).toBe('DONE');
    expect(doneBody.completedAt).toEqual(expect.any(String));

    // Permanecer em DONE mantém o completedAt original
    const stayDone = await patchTask(group.id, task.id, { status: 'DONE' }, cookie);
    expect(stayDone.status).toBe(200);
    expect((await stayDone.json()).completedAt).toBe(doneBody.completedAt);

    // Sair de DONE limpa completedAt
    const toDoing = await patchTask(group.id, task.id, { status: 'DOING' }, cookie);
    expect(toDoing.status).toBe(200);
    const doingBody = await toDoing.json();
    expect(doingBody.status).toBe('DOING');
    expect(doingBody.completedAt).toBeNull();
  });

  test('retorna 403 quando MEMBER tenta editar outros campos (ou assignees) de tarefa de outro autor', async () => {
    const owner = await orchestrator.createUser();
    const member = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, member, 'MEMBER');
    const task = await orchestrator.createTask(group, owner);
    const { cookie } = await orchestrator.createSession(member);

    const editTitle = await patchTask(
      group.id,
      task.id,
      { status: 'DOING', title: 'Mudado' },
      cookie,
    );
    expect(editTitle.status).toBe(403);
    expect(await editTitle.json()).toMatchObject({
      name: 'ForbiddenError',
      message: 'Você só pode editar as tarefas que criou.',
      statusCode: 403,
    });

    const editAssignees = await patchTask(group.id, task.id, { assigneeIds: [member.id] }, cookie);
    expect(editAssignees.status).toBe(403);
    expect((await editAssignees.json()).message).toBe('Você só pode editar as tarefas que criou.');
  });

  test('autor (MEMBER), ADMIN e OWNER podem editar todos os campos incluindo assigneeIds', async () => {
    const owner = await orchestrator.createUser();
    const admin = await orchestrator.createUser();
    const member = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, admin, 'ADMIN');
    await orchestrator.addMember(group, member, 'MEMBER');

    const task = await orchestrator.createTask(group, member, { title: 'Inicial' });

    const memberSession = await orchestrator.createSession(member);
    const res1 = await patchTask(
      group.id,
      task.id,
      { title: 'Editada pelo autor', priority: 'HIGH', assigneeIds: [member.id] },
      memberSession.cookie,
    );
    expect(res1.status).toBe(200);
    expect(await res1.json()).toMatchObject({
      title: 'Editada pelo autor',
      priority: 'HIGH',
      assignees: [expect.objectContaining({ userId: member.id })],
    });

    const adminSession = await orchestrator.createSession(admin);
    const res2 = await patchTask(
      group.id,
      task.id,
      { description: 'Detalhe do admin', assigneeIds: [owner.id, admin.id] },
      adminSession.cookie,
    );
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.description).toBe('Detalhe do admin');
    expect(body2.assignees.map((a) => a.userId).sort()).toEqual([owner.id, admin.id].sort());

    const ownerSession = await orchestrator.createSession(owner);
    const res3 = await patchTask(group.id, task.id, { assigneeIds: [] }, ownerSession.cookie);
    expect(res3.status).toBe(200);
    expect((await res3.json()).assignees).toEqual([]);
  });

  test('retorna 400 quando assigneeIds inclui quem não é membro', async () => {
    const owner = await orchestrator.createUser();
    const outsider = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const task = await orchestrator.createTask(group, owner);
    const { cookie } = await orchestrator.createSession(owner);

    const response = await patchTask(group.id, task.id, { assigneeIds: [outsider.id] }, cookie);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      name: 'ValidationError',
      message: 'Só é possível atribuir tarefas a membros do grupo.',
      statusCode: 400,
    });
  });

  test('retorna 400 quando nenhum campo é enviado', async () => {
    const owner = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const task = await orchestrator.createTask(group, owner);
    const { cookie } = await orchestrator.createSession(owner);

    const response = await patchTask(group.id, task.id, {}, cookie);
    expect(response.status).toBe(400);
  });

  test('retorna 404 para tarefa inexistente ou não membro', async () => {
    const owner = await orchestrator.createUser();
    const outsider = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const task = await orchestrator.createTask(group, owner);

    const ownerSession = await orchestrator.createSession(owner);
    const missing = await patchTask(
      group.id,
      '00000000-0000-0000-0000-000000000000',
      { title: 'X' },
      ownerSession.cookie,
    );
    expect(missing.status).toBe(404);

    const outsiderSession = await orchestrator.createSession(outsider);
    const notMember = await patchTask(
      group.id,
      task.id,
      { status: 'DONE' },
      outsiderSession.cookie,
    );
    expect(notMember.status).toBe(404);
  });

  test('retorna 401 sem autenticação', async () => {
    const response = await patchTask(
      '00000000-0000-0000-0000-000000000000',
      '00000000-0000-0000-0000-000000000001',
      { status: 'DONE' },
    );
    expect(response.status).toBe(401);
  });
});
