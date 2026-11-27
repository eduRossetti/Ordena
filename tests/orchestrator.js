import { prisma } from 'infra/database';
import bcrypt from 'bcryptjs';
import session from '@/models/session';

let counter = 0;

async function clearDatabase() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE task_assignees, tasks, group_invites, group_members, groups, sessions, users CASCADE',
  );
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

// Cria grupo e coloca `owner` como OWNER direto no banco.
async function createGroup(owner, overrides = {}) {
  counter += 1;
  return prisma.group.create({
    data: {
      name: `Grupo ${counter}`,
      description: null,
      ...overrides,
      members: {
        create: {
          userId: owner.id,
          role: 'OWNER',
        },
      },
    },
  });
}

// Adiciona usuário como membro do grupo direto no banco.
function addMember(group, user, role = 'MEMBER') {
  return prisma.groupMember.create({
    data: {
      groupId: group.id,
      userId: user.id,
      role,
    },
  });
}

// Cria convite direto no banco.
function createInvite(group, invitedUser, invitedBy, overrides = {}) {
  return prisma.groupInvite.create({
    data: {
      groupId: group.id,
      invitedUserId: invitedUser.id,
      invitedById: invitedBy?.id ?? null,
      ...overrides,
    },
  });
}

// Cria tarefa direto no banco (com assignees opcionais via `assigneeIds`).
async function createTask(group, createdBy, overrides = {}) {
  counter += 1;
  const { assigneeIds = [], ...rest } = overrides;
  return prisma.task.create({
    data: {
      groupId: group.id,
      title: `Tarefa ${counter}`,
      createdById: createdBy?.id ?? null,
      ...rest,
      ...(assigneeIds.length > 0
        ? {
            assignees: {
              create: assigneeIds.map((userId) => ({ userId })),
            },
          }
        : {}),
    },
  });
}

const orchestrator = {
  clearDatabase,
  createUser,
  createSession,
  createGroup,
  addMember,
  createInvite,
  createTask,
};

export default orchestrator;
