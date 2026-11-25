import { prisma } from 'infra/database';
import bcrypt from 'bcryptjs';
import session from '@/models/session';

let counter = 0;

async function clearDatabase() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE sessions, users CASCADE');
}

// Grava direto no banco (sem passar pelo model) com senha conhecida.
async function createUser(overrides = {}) {
  counter += 1;
  const password = overrides.password ?? 'senha-forte-123';
  const { password: _ignored, ...rest } = overrides;
  const user = await prisma.user.create({
    data: {
      username: `user_${counter}_${Date.now()}`.slice(0, 30),
      name: `Usuário ${counter}`,
      email: `user${counter}_${Date.now()}@example.com`,
      passwordHash: await bcrypt.hash(password, 4),
      ...rest,
    },
  });
  return { ...user, password };
}

// Faz login pelo model e devolve os tokens e a string `Cookie` pronta para a request.
async function createSession(user) {
  const tokens = await session.create({ email: user.email, password: user.password });
  return {
    ...tokens,
    cookie: `access_token=${tokens.accessToken}; refresh_token=${tokens.refreshToken}`,
  };
}

const orchestrator = { clearDatabase, createUser, createSession };

export default orchestrator;
