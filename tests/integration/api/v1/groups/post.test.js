import { POST } from '@/app/api/v1/groups/route';
import { prisma } from 'infra/database';
import orchestrator from '../../../../orchestrator';

beforeEach(async () => {
  await orchestrator.clearDatabase();
});

function postGroup(body, cookie) {
  return POST(
    new Request('http://localhost/api/v1/groups', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    {},
  );
}

describe('POST /api/v1/groups', () => {
  test('retorna 201 ao criar grupo e coloca o criador como OWNER', async () => {
    const user = await orchestrator.createUser();
    const { cookie } = await orchestrator.createSession(user);

    const response = await postGroup(
      { name: 'Apartamento 302', description: 'Tarefas da casa' },
      cookie,
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({
      id: expect.any(String),
      name: 'Apartamento 302',
      description: 'Tarefas da casa',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });

    const membership = await prisma.groupMember.findUnique({ where: { userId: user.id } });
    expect(membership).toMatchObject({
      groupId: body.id,
      userId: user.id,
      role: 'OWNER',
    });
  });

  test('normaliza descrição vazia para null', async () => {
    const user = await orchestrator.createUser();
    const { cookie } = await orchestrator.createSession(user);

    const response = await postGroup({ name: 'Casa', description: '   ' }, cookie);
    expect(response.status).toBe(201);
    expect((await response.json()).description).toBeNull();
  });

  test('retorna 409 quando o usuário já participa de um grupo', async () => {
    const user = await orchestrator.createUser();
    await orchestrator.createGroup(user);
    const { cookie } = await orchestrator.createSession(user);

    const response = await postGroup({ name: 'Outro grupo' }, cookie);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      name: 'ConflictError',
      message: 'Você já participa de um grupo.',
      action: 'Saia do grupo atual para criar outro.',
      statusCode: 409,
    });
  });

  test('retorna 400 quando o nome é inválido ou o JSON é malformado', async () => {
    const user = await orchestrator.createUser();
    const { cookie } = await orchestrator.createSession(user);

    const emptyName = await postGroup({ name: '   ' }, cookie);
    expect(emptyName.status).toBe(400);
    expect((await emptyName.json()).name).toBe('ValidationError');

    const longName = await postGroup({ name: 'a'.repeat(51) }, cookie);
    expect(longName.status).toBe(400);
    const longNameBody = await longName.json();
    expect(longNameBody.name).toBe('ValidationError');
    expect(longNameBody.message).toBe('O nome do grupo deve ter no máximo 50 caracteres.');

    const badJson = await postGroup('{invalido', cookie);
    expect(badJson.status).toBe(400);
    expect((await badJson.json()).name).toBe('ValidationError');
  });

  test('retorna 401 sem autenticação', async () => {
    const response = await postGroup({ name: 'Casa' });
    expect(response.status).toBe(401);
    expect((await response.json()).name).toBe('UnauthorizedError');
  });

  test('banco garante no máximo 1 grupo por usuário e no máximo 1 OWNER por grupo', async () => {
    const owner1 = await orchestrator.createUser();
    const owner2 = await orchestrator.createUser();
    const group1 = await orchestrator.createGroup(owner1);
    const group2 = await orchestrator.createGroup(owner2);

    // Mesmo usuário em segundo grupo deve violar UNIQUE(user_id)
    await expect(orchestrator.addMember(group2, owner1, 'MEMBER')).rejects.toMatchObject({
      code: 'P2002',
    });

    // Segundo OWNER no mesmo grupo deve violar índice único parcial
    const anotherUser = await orchestrator.createUser();
    await expect(orchestrator.addMember(group1, anotherUser, 'OWNER')).rejects.toMatchObject({
      code: 'P2002',
    });
  });
});
