import { POST } from '@/app/api/v1/users/route';
import orchestrator from '../../../../orchestrator';

beforeEach(async () => {
  await orchestrator.clearDatabase();
});

function postUser(body) {
  return POST(
    new Request('http://localhost/api/v1/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    {},
  );
}

const validInput = {
  username: 'maria_silva',
  name: 'Maria Silva',
  email: 'maria@example.com',
  password: 'senha-forte-123',
};

describe('POST /api/v1/users', () => {
  test('cria o usuário e devolve só campos públicos', async () => {
    const response = await postUser(validInput);
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body).toEqual({
      id: expect.any(String),
      username: 'maria_silva',
      name: 'Maria Silva',
      email: 'maria@example.com',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(body).not.toHaveProperty('passwordHash');
    expect(body).not.toHaveProperty('password');
  });

  test('normaliza username e e-mail para minúsculo', async () => {
    const response = await postUser({
      ...validInput,
      username: 'Maria_Silva',
      email: 'Maria@Example.COM',
    });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.username).toBe('maria_silva');
    expect(body.email).toBe('maria@example.com');
  });

  test('retorna 409 se o username já existe (ignorando maiúsculas)', async () => {
    await postUser(validInput);
    const response = await postUser({
      ...validInput,
      username: 'MARIA_SILVA',
      email: 'outra@example.com',
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      name: 'ConflictError',
      message: 'Este username já está em uso.',
      action: 'Escolha outro username.',
      statusCode: 409,
    });
  });

  test('retorna 409 se o e-mail já existe', async () => {
    await postUser(validInput);
    const response = await postUser({ ...validInput, username: 'outro_user' });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      name: 'ConflictError',
      message: 'Este e-mail já está em uso.',
      action: 'Use outro e-mail ou faça login.',
      statusCode: 409,
    });
  });

  test.each([
    ['username curto', { username: 'ab' }, 'O username deve ter de 3 a 30 caracteres.'],
    [
      'username com caracteres inválidos',
      { username: 'maria silva!' },
      'O username só pode ter letras, números e _.',
    ],
    ['e-mail inválido', { email: 'nao-e-email' }, 'Informe um e-mail válido.'],
    ['senha curta', { password: '1234567' }, 'A senha deve ter de 8 a 72 caracteres.'],
    ['nome vazio', { name: '' }, 'Informe o nome.'],
  ])('retorna 400 com %s', async (_label, override, message) => {
    const response = await postUser({ ...validInput, ...override });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.name).toBe('ValidationError');
    expect(body.message).toBe(message);
    expect(body.statusCode).toBe(400);
  });

  test('retorna 400 se o corpo não for JSON válido', async () => {
    const response = await POST(
      new Request('http://localhost/api/v1/users', { method: 'POST', body: 'não é json' }),
      {},
    );
    expect(response.status).toBe(400);
    expect((await response.json()).name).toBe('ValidationError');
  });
});
