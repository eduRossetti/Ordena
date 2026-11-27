import { z } from 'zod';
import { prisma } from 'infra/database';
import { ForbiddenError, NotFoundError, ValidationError } from 'infra/errors';
import { findMembership, isValidUuid } from '@/models/group';

const userSummarySelect = {
  id: true,
  username: true,
  name: true,
};

const taskSelect = {
  id: true,
  groupId: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: userSummarySelect },
  assignees: {
    select: {
      assignedAt: true,
      user: { select: userSummarySelect },
    },
    orderBy: { assignedAt: 'asc' },
  },
};

function formatTask(task) {
  return {
    id: task.id,
    groupId: task.groupId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    createdBy: task.createdBy,
    assignees: task.assignees.map((assignee) => ({
      userId: assignee.user.id,
      username: assignee.user.username,
      name: assignee.user.name,
      assignedAt: assignee.assignedAt,
    })),
    completedAt: task.completedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

const statusSchema = z.enum(['TODO', 'DOING', 'DONE'], {
  error: 'Informe um status válido (TODO, DOING ou DONE).',
});

const prioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH'], {
  error: 'Informe uma prioridade válida (LOW, MEDIUM ou HIGH).',
});

const titleSchema = z
  .string({ error: 'Informe o título da tarefa.' })
  .trim()
  .min(1, 'Informe o título da tarefa.')
  .max(120, 'O título da tarefa deve ter no máximo 120 caracteres.');

const descriptionSchema = z
  .string({ error: 'A descrição deve ser um texto.' })
  .trim()
  .max(1000, 'A descrição deve ter no máximo 1000 caracteres.')
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

const dueDateSchema = z
  .string({ error: 'Informe uma data válida.' })
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Informe uma data válida.')
  .transform((value) => new Date(value))
  .nullable()
  .optional();

const assigneeIdsSchema = z
  .array(
    z
      .string({ error: 'Informe IDs de usuário válidos.' })
      .pipe(z.uuid('Informe IDs de usuário válidos.')),
    { error: 'Informe uma lista de responsáveis.' },
  )
  .transform((ids) => [...new Set(ids)]);

const createSchema = z.object({
  title: titleSchema,
  description: descriptionSchema,
  status: statusSchema.optional(),
  priority: prioritySchema.optional(),
  dueDate: dueDateSchema,
  assigneeIds: assigneeIdsSchema.optional(),
});

const updateSchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema,
    status: statusSchema.optional(),
    priority: prioritySchema.optional(),
    dueDate: dueDateSchema,
    assigneeIds: assigneeIdsSchema.optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.description !== undefined ||
      data.status !== undefined ||
      data.priority !== undefined ||
      data.dueDate !== undefined ||
      data.assigneeIds !== undefined,
    { message: 'Informe ao menos um campo para atualizar.' },
  );

async function assertAssigneesAreMembers(tx, groupId, assigneeIds) {
  if (!assigneeIds || assigneeIds.length === 0) return;

  const memberCount = await tx.groupMember.count({
    where: {
      groupId,
      userId: { in: assigneeIds },
    },
  });

  if (memberCount !== assigneeIds.length) {
    throw new ValidationError({
      message: 'Só é possível atribuir tarefas a membros do grupo.',
      action: 'Escolha apenas pessoas que participam do grupo.',
    });
  }
}

async function findAllByGroupId(user, groupId, { status } = {}) {
  await findMembership(user, groupId);

  const parsedStatus = status ? statusSchema.parse(status) : undefined;

  const tasks = await prisma.task.findMany({
    where: {
      groupId,
      ...(parsedStatus ? { status: parsedStatus } : {}),
    },
    select: taskSelect,
    orderBy: { createdAt: 'desc' },
  });

  return tasks.map(formatTask);
}

async function create(user, groupId, input) {
  return prisma.$transaction(async (tx) => {
    await findMembership(user, groupId, tx);

    const data = createSchema.parse(input);
    const assigneeIds = data.assigneeIds ?? [];
    await assertAssigneesAreMembers(tx, groupId, assigneeIds);

    const status = data.status ?? 'TODO';
    const created = await tx.task.create({
      data: {
        groupId,
        title: data.title,
        description: data.description ?? null,
        status,
        priority: data.priority ?? 'MEDIUM',
        dueDate: data.dueDate ?? null,
        createdById: user.id,
        completedAt: status === 'DONE' ? new Date() : null,
        ...(assigneeIds.length > 0
          ? {
              assignees: {
                create: assigneeIds.map((userId) => ({ userId })),
              },
            }
          : {}),
      },
      select: taskSelect,
    });

    return formatTask(created);
  });
}

async function findOneById(user, groupId, taskId) {
  await findMembership(user, groupId);

  if (!isValidUuid(taskId)) {
    throw new NotFoundError({ message: 'Tarefa não encontrada.' });
  }

  const found = await prisma.task.findFirst({
    where: { id: taskId, groupId },
    select: taskSelect,
  });

  if (!found) {
    throw new NotFoundError({ message: 'Tarefa não encontrada.' });
  }

  return formatTask(found);
}

async function update(user, groupId, taskId, input) {
  return prisma.$transaction(async (tx) => {
    const membership = await findMembership(user, groupId, tx);

    if (!isValidUuid(taskId)) {
      throw new NotFoundError({ message: 'Tarefa não encontrada.' });
    }

    const found = await tx.task.findFirst({
      where: { id: taskId, groupId },
      select: { id: true, status: true, completedAt: true, createdById: true },
    });

    if (!found) {
      throw new NotFoundError({ message: 'Tarefa não encontrada.' });
    }

    const data = updateSchema.parse(input);

    const editsBeyondStatus =
      data.title !== undefined ||
      data.description !== undefined ||
      data.priority !== undefined ||
      data.dueDate !== undefined ||
      data.assigneeIds !== undefined;

    if (editsBeyondStatus && membership.role === 'MEMBER' && found.createdById !== user.id) {
      throw new ForbiddenError({
        message: 'Você só pode editar as tarefas que criou.',
        action: 'Peça ao autor ou a um administrador do grupo.',
      });
    }

    if (data.assigneeIds !== undefined) {
      await assertAssigneesAreMembers(tx, groupId, data.assigneeIds);
    }

    let completedAtUpdate = {};
    if (data.status !== undefined) {
      if (data.status === 'DONE' && found.status !== 'DONE') {
        completedAtUpdate = { completedAt: new Date() };
      } else if (data.status !== 'DONE' && found.status === 'DONE') {
        completedAtUpdate = { completedAt: null };
      }
    }

    if (data.assigneeIds !== undefined) {
      await tx.taskAssignee.deleteMany({ where: { taskId: found.id } });
      if (data.assigneeIds.length > 0) {
        await tx.taskAssignee.createMany({
          data: data.assigneeIds.map((userId) => ({ taskId: found.id, userId })),
        });
      }
    }

    const updated = await tx.task.update({
      where: { id: found.id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
        ...completedAtUpdate,
      },
      select: taskSelect,
    });

    return formatTask(updated);
  });
}

async function remove(user, groupId, taskId) {
  await prisma.$transaction(async (tx) => {
    const membership = await findMembership(user, groupId, tx);

    if (!isValidUuid(taskId)) {
      throw new NotFoundError({ message: 'Tarefa não encontrada.' });
    }

    const found = await tx.task.findFirst({
      where: { id: taskId, groupId },
      select: { id: true, createdById: true },
    });

    if (!found) {
      throw new NotFoundError({ message: 'Tarefa não encontrada.' });
    }

    if (membership.role === 'MEMBER' && found.createdById !== user.id) {
      throw new ForbiddenError({
        message: 'Você só pode editar as tarefas que criou.',
        action: 'Peça ao autor ou a um administrador do grupo.',
      });
    }

    await tx.task.delete({ where: { id: found.id } });
  });
}

const task = {
  findAllByGroupId,
  create,
  findOneById,
  update,
  remove,
};

export default task;
