import { DELETE, GET, PATCH, PUT } from '@/app/api/v1/groups/[groupId]/tasks/route';
import orchestrator from '../../../../../../orchestrator';

beforeEach(async () => {
  await orchestrator.clearDatabase();
});

function getTasks(groupId, { cookie, query = '' } = {}) {
  return GET(
    new Request(`http://localhost/api/v1/groups/${groupId}/tasks${query}`, {
      headers: cookie ? { cookie } : {},
    }),
    { params: Promise.resolve({ groupId }) },
  );
}

describe('GET /api/v1/groups/[groupId]/tasks', () => {
  test('retorna 200 com todas as tarefas do grupo e suporta filtro ?status=', async () => {
    const owner = await orchestrator.createUser();
    const member = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, member, 'MEMBER');

    const todo = await orchestrator.createTask(group, owner, { title: 'T1', status: 'TODO' });
    const doing = await orchestrator.createTask(group, member, { title: 'T2', status: 'DOING' });
    const done = await orchestrator.createTask(group, owner, {
      title: 'T3',
      status: 'DONE',
      completedAt: new Date(),
    });

    const { cookie } = await orchestrator.createSession(member);

    const allRes = await getTasks(group.id, { cookie });
    expect(allRes.status).toBe(200);
    const all = await allRes.json();
    expect(all.map((t) => t.id).sort()).toEqual([todo.id, doing.id, done.id].sort());

    const doingRes = await getTasks(group.id, { cookie, query: '?status=DOING' });
    expect(doingRes.status).toBe(200);
    const filtered = await doingRes.json();
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(doing.id);
  });

  test('retorna 400 quando ?status= é inválido', async () => {
    const owner = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const { cookie } = await orchestrator.createSession(owner);

    const response = await getTasks(group.id, { cookie, query: '?status=INVALIDO' });
    expect(response.status).toBe(400);
    expect((await response.json()).name).toBe('ValidationError');
  });

  test('retorna 404 para não membro', async () => {
    const owner = await orchestrator.createUser();
    const outsider = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const { cookie } = await orchestrator.createSession(outsider);

    const response = await getTasks(group.id, { cookie });
    expect(response.status).toBe(404);
  });

  test('retorna 401 sem autenticação', async () => {
    const response = await getTasks('00000000-0000-0000-0000-000000000000');
    expect(response.status).toBe(401);
  });

  test.each([
    ['PUT', PUT],
    ['PATCH', PATCH],
    ['DELETE', DELETE],
  ])('%s retorna 405', async (method, handler) => {
    const response = await handler(
      new Request('http://localhost/api/v1/groups/x/tasks', { method }),
      { params: Promise.resolve({ groupId: 'x' }) },
    );
    expect(response.status).toBe(405);
  });
});
