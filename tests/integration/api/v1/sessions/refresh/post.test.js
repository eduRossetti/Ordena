import { POST } from '@/app/api/v1/sessions/refresh/route';
import { prisma } from 'infra/database';
import { hashToken } from 'infra/token';
import orchestrator from '../../../../../orchestrator';

beforeEach(async () => {
  await orchestrator.clearDatabase();
});

function refresh(refreshToken) {
  return POST(
    new Request('http://localhost/api/v1/sessions/refresh', {
      method: 'POST',
      headers: refreshToken ? { cookie: `refresh_token=${refreshToken}` } : {},
    }),
    {},
  );
}

function cookieValue(response, name) {
  const line = response.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
  return line?.split(';')[0].split('=')[1];
}

describe('POST /api/v1/sessions/refresh', () => {
  test('rotaciona: devolve tokens novos e revoga o refresh usado', async () => {
    const user = await orchestrator.createUser();
    const { refreshToken } = await orchestrator.createSession(user);

    const response = await refresh(refreshToken);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user.id).toBe(user.id);
    expect(body.expiresAt).toEqual(expect.any(String));

    const newRefresh = cookieValue(response, 'refresh_token');
    expect(newRefresh).toBeTruthy();
    expect(newRefresh).not.toBe(refreshToken);
    expect(cookieValue(response, 'access_token')).toBeTruthy();

    const old = await prisma.session.findUnique({ where: { tokenHash: hashToken(refreshToken) } });
    expect(old.revokedAt).not.toBeNull();
    const fresh = await prisma.session.findUnique({ where: { tokenHash: hashToken(newRefresh) } });
    expect(fresh.revokedAt).toBeNull();
  });

  test('o refresh novo também funciona (cadeia de rotações)', async () => {
    const user = await orchestrator.createUser();
    const { refreshToken } = await orchestrator.createSession(user);
    const first = await refresh(refreshToken);
    const second = await refresh(cookieValue(first, 'refresh_token'));
    expect(second.status).toBe(200);
  });

  test('retorna 401 sem cookie', async () => {
    const response = await refresh();
    expect(response.status).toBe(401);
    expect((await response.json()).name).toBe('UnauthorizedError');
  });

  test('retorna 401 com refresh desconhecido e limpa os cookies', async () => {
    const response = await refresh('token-que-nao-existe');
    expect(response.status).toBe(401);
    const cookies = response.headers.getSetCookie().join('\n');
    expect(cookies).toMatch(/access_token=;/);
    expect(cookies).toMatch(/refresh_token=;/);
  });

  test('retorna 401 com sessão expirada', async () => {
    const user = await orchestrator.createUser();
    const { refreshToken } = await orchestrator.createSession(user);
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await refresh(refreshToken);
    expect(response.status).toBe(401);
  });

  test('reuso de refresh revogado derruba todas as sessões do usuário', async () => {
    const user = await orchestrator.createUser();
    const stolen = await orchestrator.createSession(user);
    const other = await orchestrator.createSession(user); // outro aparelho
    await refresh(stolen.refreshToken); // uso legítimo: revoga `stolen`

    const replay = await refresh(stolen.refreshToken); // alguém reapresenta o antigo
    expect(replay.status).toBe(401);

    const active = await prisma.session.count({ where: { userId: user.id, revokedAt: null } });
    expect(active).toBe(0);
    expect((await refresh(other.refreshToken)).status).toBe(401);
  });

  test('duas requisições simultâneas com o mesmo refresh: só uma passa e a conta é protegida', async () => {
    const user = await orchestrator.createUser();
    const { refreshToken } = await orchestrator.createSession(user);

    const responses = await Promise.all([refresh(refreshToken), refresh(refreshToken)]);
    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 401]);

    // A perdedora é tratada como reuso: nenhuma sessão fica ativa.
    const active = await prisma.session.count({ where: { userId: user.id, revokedAt: null } });
    expect(active).toBe(0);
  });
});
