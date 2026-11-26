import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { signAccessToken } from 'infra/token';
import { proxy } from '@/proxy';

const SECRET = 'segredo-de-teste-com-mais-de-32-caracteres-ok';

beforeAll(() => {
  process.env.JWT_SECRET = SECRET;
});

function request(path, token) {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: token ? { cookie: `access_token=${token}` } : {},
  });
}

const user = { id: 'user-1', username: 'maria', name: 'Maria', sessionId: 'session-1' };

function expectRedirectToLogin(response) {
  expect(response.status).toBe(307);
  expect(new URL(response.headers.get('location')).pathname).toBe('/login');
}

function expectPassThrough(response) {
  expect(response.headers.get('x-middleware-next')).toBe('1');
  expect(response.headers.get('location')).toBeNull();
}

describe('proxy (proteção de rotas)', () => {
  test('sem cookie de sessão, redireciona rota protegida para /login', async () => {
    expectRedirectToLogin(await proxy(request('/')));
  });

  test('token com assinatura inválida redireciona para /login', async () => {
    const forged = await new SignJWT({ username: 'x', name: 'x', sid: 's' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuer('ordena')
      .setAudience('ordena')
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode('outro-segredo-com-mais-de-32-caracteres!!'));

    expectRedirectToLogin(await proxy(request('/', forged)));
  });

  test('token expirado redireciona para /login', async () => {
    const expired = await new SignJWT({ username: 'x', name: 'x', sid: 's' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuer('ordena')
      .setAudience('ordena')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(SECRET));

    expectRedirectToLogin(await proxy(request('/', expired)));
  });

  test('lixo no cookie redireciona para /login', async () => {
    expectRedirectToLogin(await proxy(request('/', 'isto-nao-e-um-jwt')));
  });

  test('token válido deixa passar a rota protegida', async () => {
    const token = await signAccessToken(user);
    expectPassThrough(await proxy(request('/', token)));
  });

  test('protege também rotas aninhadas', async () => {
    expectRedirectToLogin(await proxy(request('/groups/abc/tasks')));
  });

  test.each(['/login', '/signup'])('%s é pública, mesmo sem sessão', async (path) => {
    expectPassThrough(await proxy(request(path)));
  });

  test('não confunde prefixo de rota pública com rota pública', async () => {
    expectRedirectToLogin(await proxy(request('/login-admin')));
    expectRedirectToLogin(await proxy(request('/signup/extra')));
  });
});
