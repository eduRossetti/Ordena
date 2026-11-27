import { z } from 'zod';
import { prisma } from 'infra/database';
import { ConflictError, NotFoundError, UnauthorizedError } from 'infra/errors';
import password from '@/models/password';

const publicSelect = {
  id: true,
  username: true,
  name: true,
  email: true,
  createdAt: true,
  updatedAt: true,
};

// Espelhado em src/lib/validation/user.js (validação do formulário). Mude os dois juntos.
const createSchema = z.object({
  username: z
    .string({ error: 'Informe o username.' })
    .trim()
    .toLowerCase()
    .min(3, 'O username deve ter de 3 a 30 caracteres.')
    .max(30, 'O username deve ter de 3 a 30 caracteres.')
    .regex(/^[a-z0-9_]+$/, 'O username só pode ter letras, números e _.'),
  name: z
    .string({ error: 'Informe o nome.' })
    .trim()
    .min(1, 'Informe o nome.')
    .max(80, 'O nome deve ter no máximo 80 caracteres.'),
  email: z
    .string({ error: 'Informe o e-mail.' })
    .trim()
    .toLowerCase()
    .pipe(z.email('Informe um e-mail válido.')),
  password: z
    .string({ error: 'Informe a senha.' })
    .min(8, 'A senha deve ter de 8 a 72 caracteres.')
    .max(72, 'A senha deve ter de 8 a 72 caracteres.'),
});

async function create(input) {
  const data = createSchema.parse(input);

  try {
    return await prisma.user.create({
      data: {
        username: data.username,
        name: data.name,
        email: data.email,
        passwordHash: await password.hash(data.password),
      },
      select: publicSelect,
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      const target = JSON.stringify(error.meta ?? {});
      if (target.includes('username')) {
        throw new ConflictError({
          message: 'Este username já está em uso.',
          action: 'Escolha outro username.',
          cause: error,
        });
      }
      throw new ConflictError({
        message: 'Este e-mail já está em uso.',
        action: 'Use outro e-mail ou faça login.',
        cause: error,
      });
    }
    throw error;
  }
}

async function findOneById(id) {
  const found = await prisma.user.findUnique({ where: { id }, select: publicSelect });
  if (!found) throw new NotFoundError({ message: 'Usuário não encontrado.' });
  return found;
}

// Usuário dono de um token válido. Se a conta sumiu, a sessão não vale mais (401, não 404).
async function findAuthenticated(id) {
  const found = await prisma.user.findUnique({
    where: { id },
    select: {
      ...publicSelect,
      membership: {
        select: {
          groupId: true,
          role: true,
          group: { select: { name: true } },
        },
      },
    },
  });
  if (!found) throw new UnauthorizedError({ message: 'Sessão inválida ou expirada.' });

  const { membership, ...userData } = found;
  return {
    ...userData,
    membership: membership
      ? {
          groupId: membership.groupId,
          groupName: membership.group.name,
          role: membership.role,
        }
      : null,
  };
}

// Uso interno (login): inclui passwordHash. Nunca devolva isto numa resposta.
function findOneByEmailWithHash(email) {
  return prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
}

const user = { create, findOneById, findAuthenticated, findOneByEmailWithHash, publicSelect };

export default user;
