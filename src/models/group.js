import { z } from 'zod';
import { prisma } from 'infra/database';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from 'infra/errors';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

const groupSelect = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
};

const memberSelect = {
  groupId: true,
  userId: true,
  role: true,
  joinedAt: true,
  user: {
    select: {
      id: true,
      username: true,
      name: true,
    },
  },
};

function formatMember(member) {
  return {
    userId: member.user.id,
    username: member.user.username,
    name: member.user.name,
    role: member.role,
    joinedAt: member.joinedAt,
  };
}

const nameSchema = z
  .string({ error: 'Informe o nome do grupo.' })
  .trim()
  .min(1, 'Informe o nome do grupo.')
  .max(50, 'O nome do grupo deve ter no máximo 50 caracteres.');

const descriptionSchema = z
  .string({ error: 'A descrição deve ser um texto.' })
  .trim()
  .max(500, 'A descrição deve ter no máximo 500 caracteres.')
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

const createSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
});

const updateSchema = z
  .object({
    name: nameSchema.optional(),
    description: descriptionSchema,
  })
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: 'Informe ao menos um campo para atualizar.',
  });

const updateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER'], {
    error: 'Informe um papel válido (ADMIN ou MEMBER).',
  }),
});

const transferOwnershipSchema = z.object({
  userId: z
    .string({ error: 'Informe o novo dono do grupo.' })
    .pipe(z.uuid('Informe um usuário válido.')),
});

/**
 * Busca o vínculo do usuário com o grupo ou lança 404 (não revela se o grupo existe).
 */
export async function findMembership(user, groupId, tx = prisma) {
  if (!isValidUuid(groupId)) {
    throw new NotFoundError({
      message: 'Grupo não encontrado.',
      action: 'Verifique se você ainda participa deste grupo.',
    });
  }

  const membership = await tx.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId: user.id,
      },
    },
    select: {
      groupId: true,
      userId: true,
      role: true,
    },
  });

  if (!membership) {
    throw new NotFoundError({
      message: 'Grupo não encontrado.',
      action: 'Verifique se você ainda participa deste grupo.',
    });
  }

  return membership;
}

/**
 * Garante que o papel do membro está entre os permitidos; caso contrário lança 403.
 */
export function assertRole(membership, allowedRoles) {
  if (allowedRoles.includes(membership.role)) return;

  if (allowedRoles.length === 1 && allowedRoles[0] === 'OWNER') {
    throw new ForbiddenError({
      message: 'Apenas o dono do grupo pode fazer isso.',
      action: 'Peça ao dono do grupo.',
    });
  }

  throw new ForbiddenError({
    message: 'Apenas o dono e os administradores podem fazer isso.',
    action: 'Peça a um administrador do grupo.',
  });
}

/**
 * Trava as linhas dos grupos até o fim da transação (sempre na ordem dos ids, para não haver
 * deadlock entre duas transações que travam os mesmos grupos).
 * `FOR UPDATE` conflita com o `FOR KEY SHARE` que o Postgres põe no grupo ao inserir um vínculo:
 * ninguém entra num grupo enquanto ele é contado/apagado, e quem espera vê o resultado final.
 */
export async function lockGroupsTx(tx, groupIds) {
  const ids = [...new Set(groupIds)].sort();
  if (ids.length === 0) return;
  await tx.$queryRaw`SELECT id FROM groups WHERE id = ANY(${ids}::uuid[]) ORDER BY id FOR UPDATE`;
}

/**
 * Remove o vínculo de um usuário saindo do próprio grupo (dentro de transação).
 * Reutilizado ao sair diretamente ou ao aceitar convite de outro grupo.
 */
export async function leaveGroupTx(tx, membership) {
  await lockGroupsTx(tx, [membership.groupId]);

  // Relê depois do lock: o papel pode ter mudado (transferência) ou o vínculo sumido.
  const current = await tx.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId: membership.groupId,
        userId: membership.userId,
      },
    },
    select: { role: true },
  });

  if (!current) {
    throw new NotFoundError({
      message: 'Grupo não encontrado.',
      action: 'Verifique se você ainda participa deste grupo.',
    });
  }

  if (current.role === 'OWNER') {
    const memberCount = await tx.groupMember.count({
      where: { groupId: membership.groupId },
    });

    if (memberCount > 1) {
      throw new ConflictError({
        message: 'Você é o dono deste grupo.',
        action: 'Transfira a posse para outro membro antes de sair.',
      });
    }

    await tx.group.delete({ where: { id: membership.groupId } });
    return;
  }

  await tx.taskAssignee.deleteMany({
    where: {
      userId: membership.userId,
      task: { groupId: membership.groupId },
    },
  });

  await tx.groupMember.delete({
    where: {
      groupId_userId: {
        groupId: membership.groupId,
        userId: membership.userId,
      },
    },
  });
}

async function create(user, input) {
  const data = createSchema.parse(input);

  try {
    return await prisma.group.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        members: {
          create: {
            userId: user.id,
            role: 'OWNER',
          },
        },
      },
      select: groupSelect,
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new ConflictError({
        message: 'Você já participa de um grupo.',
        action: 'Saia do grupo atual para criar outro.',
        cause: error,
      });
    }
    throw error;
  }
}

async function findOneById(user, groupId) {
  await findMembership(user, groupId);
  const found = await prisma.group.findUnique({
    where: { id: groupId },
    select: groupSelect,
  });
  if (!found) {
    throw new NotFoundError({
      message: 'Grupo não encontrado.',
      action: 'Verifique se você ainda participa deste grupo.',
    });
  }
  return found;
}

async function update(user, groupId, input) {
  const membership = await findMembership(user, groupId);
  assertRole(membership, ['OWNER', 'ADMIN']);

  const data = updateSchema.parse(input);

  return prisma.group.update({
    where: { id: groupId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
    },
    select: groupSelect,
  });
}

async function remove(user, groupId) {
  await prisma.$transaction(async (tx) => {
    const membership = await findMembership(user, groupId, tx);
    assertRole(membership, ['OWNER']);
    await tx.group.delete({ where: { id: groupId } });
  });
}

async function findMembers(user, groupId) {
  await findMembership(user, groupId);
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    select: memberSelect,
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
  });
  return members.map(formatMember);
}

async function updateMemberRole(user, groupId, targetUserId, input) {
  return prisma.$transaction(async (tx) => {
    const actor = await findMembership(user, groupId, tx);
    assertRole(actor, ['OWNER']);

    if (input && typeof input === 'object' && input.role === 'OWNER') {
      throw new ValidationError({
        message: 'A posse só muda por transferência.',
        action: 'Use a transferência de posse.',
      });
    }

    const data = updateMemberRoleSchema.parse(input);

    if (!isValidUuid(targetUserId)) {
      throw new NotFoundError({ message: 'Membro não encontrado.' });
    }

    const target = await tx.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: targetUserId,
        },
      },
      select: { role: true },
    });

    if (!target) {
      throw new NotFoundError({ message: 'Membro não encontrado.' });
    }

    if (target.role === 'OWNER') {
      throw new ValidationError({
        message: 'A posse só muda por transferência.',
        action: 'Use a transferência de posse.',
      });
    }

    const updated = await tx.groupMember.update({
      where: {
        groupId_userId: {
          groupId,
          userId: targetUserId,
        },
      },
      data: { role: data.role },
      select: memberSelect,
    });

    return formatMember(updated);
  });
}

async function removeMember(user, groupId, targetUserId) {
  await prisma.$transaction(async (tx) => {
    const actor = await findMembership(user, groupId, tx);

    if (targetUserId === user.id) {
      await leaveGroupTx(tx, actor);
      return;
    }

    assertRole(actor, ['OWNER', 'ADMIN']);

    if (!isValidUuid(targetUserId)) {
      throw new NotFoundError({ message: 'Membro não encontrado.' });
    }

    const target = await tx.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: targetUserId,
        },
      },
      select: { groupId: true, userId: true, role: true },
    });

    if (!target) {
      throw new NotFoundError({ message: 'Membro não encontrado.' });
    }

    if (target.role === 'OWNER' || target.role === 'ADMIN') {
      assertRole(actor, ['OWNER']);
    }

    await tx.taskAssignee.deleteMany({
      where: {
        userId: targetUserId,
        task: { groupId },
      },
    });

    await tx.groupMember.delete({
      where: {
        groupId_userId: {
          groupId,
          userId: targetUserId,
        },
      },
    });
  });
}

async function transferOwnership(user, groupId, input) {
  return prisma.$transaction(async (tx) => {
    const actor = await findMembership(user, groupId, tx);
    assertRole(actor, ['OWNER']);

    const data = transferOwnershipSchema.parse(input);

    if (data.userId === user.id) {
      throw new ValidationError({
        message: 'Você já é o dono deste grupo.',
        action: 'Escolha outro membro para transferir a posse.',
      });
    }

    const target = await tx.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: data.userId,
        },
      },
      select: { userId: true },
    });

    if (!target) {
      throw new NotFoundError({ message: 'Membro não encontrado.' });
    }

    // Rebaixa o dono atual primeiro para respeitar o índice único parcial de OWNER.
    // O filtro por `role: 'OWNER'` é reavaliado depois do lock da linha: numa transferência
    // concorrente, a segunda encontra o vínculo já rebaixado e não atualiza nada.
    const demoted = await tx.groupMember.updateMany({
      where: { groupId, userId: user.id, role: 'OWNER' },
      data: { role: 'ADMIN' },
    });

    if (demoted.count === 0) {
      throw new ConflictError({
        message: 'A posse deste grupo já foi transferida.',
        action: 'Atualize a lista de membros.',
      });
    }

    const newOwner = await tx.groupMember.update({
      where: {
        groupId_userId: {
          groupId,
          userId: data.userId,
        },
      },
      data: { role: 'OWNER' },
      select: memberSelect,
    });

    return formatMember(newOwner);
  });
}

const group = {
  create,
  findOneById,
  update,
  remove,
  findMembers,
  updateMemberRole,
  removeMember,
  transferOwnership,
  findMembership,
  assertRole,
  leaveGroupTx,
  lockGroupsTx,
  isValidUuid,
};

export default group;
