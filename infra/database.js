import { PrismaClient } from './prisma/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// Singleton: evita abrir conexões demais no hot reload do `next dev`.
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.__ordenaPrisma ?? createClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.__ordenaPrisma = prisma;
