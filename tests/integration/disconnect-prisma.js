import { prisma } from 'infra/database';

afterAll(async () => {
  await prisma.$disconnect();
});
