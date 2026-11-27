import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { GET } from '@/app/api/v1/user/route';
import { prisma } from 'infra/database';
import orchestrator from '../../../../orchestrator';

beforeEach(async () => {
  await orchestrator.clearDatabase();
});

function getUser(cookie) {
  return GET(
    new Request('http://localhost/api/v1/user', {
      headers: cookie ? { cookie } : {},
    }),
    {},
  );
}

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET);

function forgeToken(user, { exp = '15m', secretKey = secret(), alg = 'HS256' } = {}) {
  return new SignJWT({ username: user.username, name: user.name, sid: 'x' })
    .setProtectedHeader({ alg })
    .setSubject(user.id)
    .setIssuer('ordena')
    .setAudience('ordena')
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secretKey);
}

const unauthorized = {
  name: 'UnauthorizedError',
  message: 'Sessão inválida ou expirada.',
  action: 'Faça novamente o login para continuar.',
  statusCode: 401,
};

describe('GET /api/v1/user', () => {
  test('retorna 200 com o usuário autenticado sem grupo (membership: null), sem passwordHash', async () => {
    const user = await orchestrator.createUser();
    const { cookie } = await orchestrator.createSession(user);

    const response = await getUser(cookie);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      membership: null,
    });
    expect(body).not.toHaveProperty('passwordHash');
  });

  test('retorna 200 com membership preenchido quando o usuário participa de um grupo', async () => {
    const user = await orchestrator.createUser();
    const group = await orchestrator.createGroup(user, { name: 'Casa' });
    const { cookie } = await orchestrator.createSession(user);

    const response = await getUser(cookie);
    expect(response.status).toBe(200);
    expect((await response.json()).membership).toEqual({
      groupId: group.id,
      groupName: 'Casa',
      role: 'OWNER',
    });
  });

  test('funciona com NextRequest, o tipo que o Next entrega em runtime', async () => {
    const user = await orchestrator.createUser();
    const { cookie } = await orchestrator.createSession(user);

    const response = await GET(
      new NextRequest('http://localhost/api/v1/user', { headers: { cookie } }),
      {},
    );
    expect(response.status).toBe(200);
    expect((await response.json()).id).toBe(user.id);
  });

  test('retorna 401 sem cookie', async () => {
    const response = await getUser();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ...unauthorized,
      message: 'Usuário não autenticado.',
    });
  });

  test('retorna 401 com token adulterado', async () => {
    const user = await orchestrator.createUser();
    const { accessToken } = await orchestrator.createSession(user);
    const tampered = accessToken.slice(0, -4) + 'AAAA';

    const response = await getUser(`access_token=${tampered}`);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(unauthorized);
  });

  test('retorna 401 com token expirado', async () => {
    const user = await orchestrator.createUser();
    const expired = await forgeToken(user, { exp: Math.floor(Date.now() / 1000) - 60 });

    const response = await getUser(`access_token=${expired}`);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(unauthorized);
  });

  test('retorna 401 com token assinado por outro segredo', async () => {
    const user = await orchestrator.createUser();
    const foreign = await forgeToken(user, {
      secretKey: new TextEncoder().encode('outro-segredo-com-mais-de-32-caracteres!!'),
    });

    const response = await getUser(`access_token=${foreign}`);
    expect(response.status).toBe(401);
  });

  test('retorna 401 com alg none', async () => {
    const user = await orchestrator.createUser();
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
      sub: user.id,
      iss: 'ordena',
      aud: 'ordena',
      exp: Math.floor(Date.now() / 1000) + 900,
    })}.`;

    const response = await getUser(`access_token=${unsigned}`);
    expect(response.status).toBe(401);
  });

  test('retorna 401 se o usuário do token não existe mais', async () => {
    const user = await orchestrator.createUser();
    const { cookie } = await orchestrator.createSession(user);
    await prisma.user.delete({ where: { id: user.id } });

    const response = await getUser(cookie);
    expect(response.status).toBe(401);
  });
});
