// Integration tests usam o banco ordena_test.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://ordena:ordena@localhost:5432/ordena_test';

process.env.DATABASE_URL = TEST_DATABASE_URL;

// Segredo fixo só para os testes (os testes não dependem do .env local).
process.env.JWT_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres-ok';
