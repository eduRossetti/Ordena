import { z } from 'zod';
import { prisma } from 'infra/database';
import { ConflictError, NotFoundError } from 'infra/errors';
import {
  assertRole,
  findMembership,
  isValidUuid,
  leaveGroupTx,
  lockGroupsTx,
} from '@/models/group';

const userSummarySelect = {
  id: true,
  username: true,
  name: true,
};

const inviteSelect = {
  id: true,
  groupId: true,
  status: true,
  createdAt: true,
  respondedAt: true,
  group: { select: { name: true } },
  invitedUser: { select: userSummarySelect },
  invitedBy: { select: userSummarySelect },
};

function formatInvite(invite) {
  return {
    id: invite.id,
    groupId: invite.groupId,
    groupName: invite.group.name,
    status: invite.status,
    invitedUser: invite.invitedUser,
    invitedBy: invite.invitedBy,
    createdAt: invite.createdAt,
    respondedAt: invite.respondedAt,
  };
}

const createSchema = z.object({
  username: z
    .string({ error: 'Informe o username.' })
    .trim()
    .toLowerCase()
    .min(1, 'Informe o username.'),
});

const respondSchema = z.object({
  status: z.enum(['ACCEPTED', 'DECLINED'], {
    error: 'Informe uma resposta válida (ACCEPTED ou DECLINED).',
  }),
});

async function findPendingByGroupId(user, groupId) {
  const membership = await findMembership(user, groupId);
  assertRole(membership, ['OWNER', 'ADMIN']);

  const invites = await prisma.groupInvite.findMany({
    where: { groupId, status: 'PENDING' },
    select: inviteSelect,
    orderBy: { createdAt: 'desc' },
  });

  return invites.map(formatInvite);
}

async function create(user, groupId, input) {
  const membership = await findMembership(user, groupId);
  assertRole(membership, ['OWNER', 'ADMIN']);

  const data = createSchema.parse(input);

  const targetUser = await prisma.user.findUnique({
    where: { username: data.username },
    select: { id: true },
  });

  if (!targetUser) {
    throw new NotFoundError({
      message: 'Usuário não encontrado.',
      action: 'Confira o username.',
    });
  }

  const alreadyMember = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId: targetUser.id,
      },
    },
    select: { userId: true },
  });

  if (alreadyMember) {
    throw new ConflictError({
      message: 'Esta pessoa já participa do grupo.',
      action: 'Verifique a lista de membros do grupo.',
    });
  }

  try {
    const created = await prisma.groupInvite.create({
      data: {
        groupId,
        invitedUserId: targetUser.id,
        invitedById: user.id,
      },
      select: inviteSelect,
    });
    return formatInvite(created);
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new ConflictError({
        message: 'Já existe um convite pendente para esta pessoa.',
        action: 'Aguarde a resposta ou cancele o convite anterior.',
        cause: error,
      });
    }
    throw error;
  }
}

async function cancel(user, groupId, inviteId) {
  await prisma.$transaction(async (tx) => {
    const membership = await findMembership(user, groupId, tx);
    assertRole(membership, ['OWNER', 'ADMIN']);

    if (!isValidUuid(inviteId)) {
      throw new NotFoundError({ message: 'Convite não encontrado.' });
    }

    const found = await tx.groupInvite.findFirst({
      where: { id: inviteId, groupId },
      select: { id: true, status: true },
    });

    if (!found) {
      throw new NotFoundError({ message: 'Convite não encontrado.' });
    }

    if (found.status !== 'PENDING') {
      throw new ConflictError({
        message: 'Este convite já foi respondido ou cancelado.',
        action: 'Atualize a lista de convites.',
      });
    }

    await tx.groupInvite.update({
      where: { id: found.id },
      data: { status: 'CANCELED', respondedAt: new Date() },
    });
  });
}

async function findPendingForUser(user) {
  const invites = await prisma.groupInvite.findMany({
    where: { invitedUserId: user.id, status: 'PENDING' },
    select: inviteSelect,
    orderBy: { createdAt: 'desc' },
  });

  return invites.map(formatInvite);
}

async function respond(user, inviteId, input) {
  return prisma.$transaction(async (tx) => {
    if (!isValidUuid(inviteId)) {
      throw new NotFoundError({ message: 'Convite não encontrado.' });
    }

    const target = await tx.groupInvite.findFirst({
      where: { id: inviteId, invitedUserId: user.id },
      select: { groupId: true },
    });

    if (!target) {
      throw new NotFoundError({ message: 'Convite não encontrado.' });
    }

    const data = respondSchema.parse(input);

    // Trava o grupo do convite e o grupo atual (se houver) antes de decidir: assim ninguém apaga
    // o grupo de destino nem entra no grupo de origem no meio do aceite.
    const previousMembership = await tx.groupMember.findUnique({
      where: { userId: user.id },
      select: { groupId: true },
    });
    await lockGroupsTx(tx, [target.groupId, previousMembership?.groupId].filter(Boolean));

    // Relê depois do lock: o convite pode ter sido cancelado ou apagado junto com o grupo.
    const found = await tx.groupInvite.findUnique({
      where: { id: inviteId },
      select: {
        id: true,
        groupId: true,
        status: true,
        group: { select: { name: true } },
      },
    });

    if (!found) {
      throw new NotFoundError({ message: 'Convite não encontrado.' });
    }

    if (found.status !== 'PENDING') {
      throw new ConflictError({
        message: 'Este convite já foi respondido ou cancelado.',
        action: 'Atualize seus convites.',
      });
    }

    if (data.status === 'DECLINED') {
      const declined = await tx.groupInvite.update({
        where: { id: found.id },
        data: { status: 'DECLINED', respondedAt: new Date() },
        select: inviteSelect,
      });
      return formatInvite(declined);
    }

    const currentMembership = await tx.groupMember.findUnique({
      where: { userId: user.id },
      select: { groupId: true, userId: true, role: true },
    });

    if (currentMembership && currentMembership.groupId !== found.groupId) {
      await leaveGroupTx(tx, currentMembership);
    }

    if (!currentMembership || currentMembership.groupId !== found.groupId) {
      try {
        await tx.groupMember.create({
          data: {
            groupId: found.groupId,
            userId: user.id,
            role: 'MEMBER',
          },
        });
      } catch (error) {
        // Outro aceite do mesmo usuário terminou antes (UNIQUE em group_members.user_id).
        if (error?.code === 'P2002') {
          throw new ConflictError({
            message: 'Você acabou de entrar em outro grupo.',
            action: 'Atualize a página e confira seus convites.',
            cause: error,
          });
        }
        throw error;
      }
    }

    const accepted = await tx.groupInvite.update({
      where: { id: found.id },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
      select: inviteSelect,
    });

    return {
      ...formatInvite(accepted),
      membership: {
        groupId: found.groupId,
        groupName: found.group.name,
        role: 'MEMBER',
      },
    };
  });
}

const invite = {
  findPendingByGroupId,
  create,
  cancel,
  findPendingForUser,
  respond,
};

export default invite;
