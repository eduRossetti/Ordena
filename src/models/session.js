import { z } from 'zod';
import { prisma } from 'infra/database';
import { UnauthorizedError } from 'infra/errors';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  generateRefreshToken,
  hashToken,
  signAccessToken,
} from 'infra/token';
import password from '@/models/password';
import user from '@/models/user';

// Espelhado em src/lib/validation/user.js (validação do formulário). Mude os dois juntos.
const loginSchema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z
    .string({ error: 'Informe a senha.' })
    .min(1, 'Informe a senha.')
    .max(72, 'A senha deve ter de 8 a 72 caracteres.'),
});

// Hash descartável: compara mesmo sem usuário, para igualar o tempo de resposta.
let dummyHashPromise;
function getDummyHash() {
  dummyHashPromise ??= password.hash('senha-descartavel-para-igualar-tempo');
  return dummyHashPromise;
}

function invalidCredentials() {
  return new UnauthorizedError({
    message: 'Dados de autenticação não conferem.',
    action: 'Verifique o e-mail e a senha enviados.',
  });
}

// Cria a linha de sessão (guarda só o hash do refresh) e assina o JWT de acesso.
async function issueTokens(db, account) {
  const refreshToken = generateRefreshToken();
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
  const session = await db.session.create({
    data: { userId: account.id, tokenHash: hashToken(refreshToken), expiresAt: refreshExpiresAt },
  });
  const accessToken = await signAccessToken({
    id: account.id,
    username: account.username,
    name: account.name,
    sessionId: session.id,
  });
  return {
    accessToken,
    refreshToken,
    accessExpiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000),
    refreshExpiresAt,
  };
}

async function create(input) {
  const { email, password: plainPassword } = loginSchema.parse(input);

  const account = await user.findOneByEmailWithHash(email);
  const passwordHash = account?.passwordHash ?? (await getDummyHash());
  const matches = await password.compare(plainPassword, passwordHash);
  if (!account || !matches) throw invalidCredentials();

  const tokens = await issueTokens(prisma, account);
  return { user: await user.findOneById(account.id), ...tokens };
}

/**
 * Troca o refresh token por um par novo (rotação). Cada refresh só vale uma vez:
 * reapresentar um já usado indica token roubado e derruba todas as sessões do usuário.
 */
async function refresh(refreshToken) {
  if (!refreshToken) throw new UnauthorizedError();

  const current = await prisma.session.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    include: { user: true },
  });
  if (!current) throw new UnauthorizedError();

  if (current.revokedAt) {
    await revokeAllActive(current.userId);
    throw new UnauthorizedError();
  }
  if (current.expiresAt <= new Date()) throw new UnauthorizedError();

  const tokens = await prisma.$transaction(async (tx) => {
    // Condicional em revokedAt: de duas requisições simultâneas, só uma ganha.
    const { count } = await tx.session.updateMany({
      where: { id: current.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) return null;
    return issueTokens(tx, current.user);
  });

  if (!tokens) {
    await revokeAllActive(current.userId);
    throw new UnauthorizedError();
  }
  return { user: await user.findOneById(current.userId), ...tokens };
}

/** Logout: idempotente, ignora token ausente ou desconhecido. */
async function revoke(refreshToken) {
  if (!refreshToken) return;
  await prisma.session.updateMany({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

function revokeAllActive(userId) {
  return prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

const session = { create, refresh, revoke };

export default session;
