// Integration tests usam o banco ordena_test.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://ordena:ordena@localhost:5432/ordena_test';

process.env.DATABASE_URL = TEST_DATABASE_URL;
