import { execSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './setup-env.js';

// Aplica as migrations pendentes no banco de teste antes dos testes de integração.
// Se falhar com "database ordena_test does not exist", o volume do Postgres é antigo:
// `npm run db:down -- -v` e `npm run db:up` recriam com o init.sql.
export default function globalSetup() {
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'inherit',
  });
}
