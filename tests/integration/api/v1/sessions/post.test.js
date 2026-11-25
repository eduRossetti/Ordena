import { decodeJwt } from 'jose';
import { POST } from '@/app/api/v1/sessions/route';
import { prisma } from 'infra/database';
import orchestrator from '../../../../orchestrator';

beforeEach(async () => {
  await orchestrator.clearDatabase();
});

function login(body) {
  return POST(
    new Request('http://localhost/api/v1/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    {},
  );
}

function cookiesOf(response) {
  return Object.fromEntries(
    response.headers.getSetCookie().map((line) => [line.split('=')[0], line]),
  );
}

describe('POST /api/v1/sessions', () => {
  test('autentica e entrega access e refresh em cookies httpOnly', async () => {
    const user = await orchestrator.createUser();
    const response = await login({ email: user.email, password: user.password });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body).toEqual({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
      expiresAt: expect.any(String),
    });
    expect(JSON.stringify(body)).not.toMatch(/token|passwordHash/i);

    const cookies = cookiesOf(response);
    expect(cookies.access_token).toMatch(/HttpOnly/i);
    expect(cookies.access_token).toMatch(/SameSite=lax/i);
    expect(cookies.access_token).toMatch(/Path=\/;/i);
    expect(cookies.access_token).toMatch(/Max-Age=900/);
    expect(cookies.refresh_token).toMatch(/HttpOnly/i);
    expect(cookies.refresh_token).toMatch(/Path=\/api\/v1\/sessions/i);
    expect(cookies.refresh_token).toMatch(/Max-Age=2592000/);
  });

  test('JWT leva só identidade, sem dados sensíveis nem papéis', async () => {
    const user = await orchestrator.createUser();
    const response = await login({ email: user.email, password: user.password });
    const token = cookiesOf(response).access_token.split(';')[0].split('=')[1];

    const payload = decodeJwt(token);
    expect(payload).toEqual({
      sub: user.id,
      username: user.username,
      name: user.name,
      sid: expect.any(String),
      iss: 'ordena',
      aud: 'ordena',
      iat: expect.any(Number),
      exp: expect.any(Number),
    });
    expect(payload.exp - payload.iat).toBe(900);
  });

  test('grava só o hash do refresh token', async () => {
    const user = await orchestrator.createUser();
    const response = await login({ email: user.email, password: user.password });
    const refresh = cookiesOf(response).refresh_token.split(';')[0].split('=')[1];

    const sessions = await prisma.session.findMany({ where: { userId: user.id } });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tokenHash).not.toBe(refresh);
    expect(sessions[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(sessions[0].revokedAt).toBeNull();
  });

  test('aceita e-mail com maiúsculas', async () => {
    const user = await orchestrator.createUser();
    const response = await login({ email: user.email.toUpperCase(), password: user.password });
    expect(response.status).toBe(201);
  });

  test('retorna 401 genérico com senha errada e com e-mail inexistente', async () => {
    const user = await orchestrator.createUser();
    const wrongPassword = await login({ email: user.email, password: 'senha-errada-123' });
    const unknownEmail = await login({
      email: 'ninguem@example.com',
      password: 'senha-errada-123',
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    const expected = {
      name: 'UnauthorizedError',
      message: 'Dados de autenticação não conferem.',
      action: 'Verifique o e-mail e a senha enviados.',
      statusCode: 401,
    };
    expect(await wrongPassword.json()).toEqual(expected);
    expect(await unknownEmail.json()).toEqual(expected);
    expect(wrongPassword.headers.getSetCookie()).toHaveLength(0);
  });

  test('retorna 400 com corpo inválido', async () => {
    const response = await login({ email: 'nao-e-email' });
    expect(response.status).toBe(400);
    expect((await response.json()).name).toBe('ValidationError');
  });
});
