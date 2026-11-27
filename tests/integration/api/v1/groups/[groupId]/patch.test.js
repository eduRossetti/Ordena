import { PATCH } from '@/app/api/v1/groups/[groupId]/route';
import orchestrator from '../../../../../orchestrator';

beforeEach(async () => {
  await orchestrator.clearDatabase();
});

function patchGroup(groupId, body, cookie) {
  return PATCH(
    new Request(`http://localhost/api/v1/groups/${groupId}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ groupId }) },
  );
}

describe('PATCH /api/v1/groups/[groupId]', () => {
  test('retorna 200 quando OWNER ou ADMIN edita o grupo', async () => {
    const owner = await orchestrator.createUser();
    const admin = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner, { name: 'Antigo', description: 'Desc' });
    await orchestrator.addMember(group, admin, 'ADMIN');

    const ownerSession = await orchestrator.createSession(owner);
    const res1 = await patchGroup(group.id, { name: 'Novo Nome' }, ownerSession.cookie);
    expect(res1.status).toBe(200);
    expect(await res1.json()).toMatchObject({
      id: group.id,
      name: 'Novo Nome',
      description: 'Desc',
    });

    const adminSession = await orchestrator.createSession(admin);
    const res2 = await patchGroup(group.id, { description: 'Nova descrição' }, adminSession.cookie);
    expect(res2.status).toBe(200);
    expect(await res2.json()).toMatchObject({
      id: group.id,
      name: 'Novo Nome',
      description: 'Nova descrição',
    });
  });

  test('retorna 403 quando MEMBER tenta editar o grupo', async () => {
    const owner = await orchestrator.createUser();
    const member = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    await orchestrator.addMember(group, member, 'MEMBER');
    const { cookie } = await orchestrator.createSession(member);

    const response = await patchGroup(group.id, { name: 'Hack' }, cookie);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      name: 'ForbiddenError',
      message: 'Apenas o dono e os administradores podem fazer isso.',
      action: 'Peça a um administrador do grupo.',
      statusCode: 403,
    });
  });

  test('retorna 404 para não membro', async () => {
    const owner = await orchestrator.createUser();
    const outsider = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const { cookie } = await orchestrator.createSession(outsider);

    const response = await patchGroup(group.id, { name: 'Outro' }, cookie);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      name: 'NotFoundError',
      message: 'Grupo não encontrado.',
      action: 'Verifique se você ainda participa deste grupo.',
      statusCode: 404,
    });
  });

  test('retorna 400 quando não envia nenhum campo ou nome é vazio', async () => {
    const owner = await orchestrator.createUser();
    const group = await orchestrator.createGroup(owner);
    const { cookie } = await orchestrator.createSession(owner);

    const empty = await patchGroup(group.id, {}, cookie);
    expect(empty.status).toBe(400);
    expect((await empty.json()).name).toBe('ValidationError');

    const blankName = await patchGroup(group.id, { name: '  ' }, cookie);
    expect(blankName.status).toBe(400);
    expect((await blankName.json()).name).toBe('ValidationError');
  });

  test('retorna 401 sem autenticação', async () => {
    const response = await patchGroup('00000000-0000-0000-0000-000000000000', { name: 'X' });
    expect(response.status).toBe(401);
  });
});
