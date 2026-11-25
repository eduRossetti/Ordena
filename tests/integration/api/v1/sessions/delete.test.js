import { DELETE } from '@/app/api/v1/sessions/route';
import { prisma } from 'infra/database';
import { hashToken } from 'infra/token';
import orchestrator from '../../../../orchestrator';

beforeEach(async () => {
  await orchestrator.clearDatabase();
});

function logout(cookie) {
  return DELETE(
    new Request('http://localhost/api/v1/sessions', {
      method: 'DELETE',
      headers: cookie ? { cookie } : {},
    }),
    {},
  );
}

describe('DELETE /api/v1/sessions', () => {
  test('revoga a sessão, limpa os cookies e devolve 204', async () => {
    const user = await orchestrator.createUser();
    const { refreshToken, cookie } = await orchestrator.createSession(user);

    const response = await logout(cookie);
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');

    const cookies = response.headers.getSetCookie().join('\n');
    expect(cookies).toMatch(/access_token=;.*Max-Age=0/i);
    expect(cookies).toMatch(/refresh_token=;.*Max-Age=0/i);

    const stored = await prisma.session.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
    });
    expect(stored.revokedAt).not.toBeNull();
  });

  test('só revoga a sessão do aparelho, não as outras', async () => {
    const user = await orchestrator.createUser();
    const mine = await orchestrator.createSession(user);
    await orchestrator.createSession(user);

    await logout(mine.cookie);
    const active = await prisma.session.count({ where: { userId: user.id, revokedAt: null } });
    expect(active).toBe(1);
  });

  test('é idempotente: 204 sem cookie', async () => {
    const response = await logout();
    expect(response.status).toBe(204);
  });
});
