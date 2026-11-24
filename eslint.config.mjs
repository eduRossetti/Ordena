import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier/flat';

const eslintConfig = defineConfig([
  ...nextVitals,
  prettier,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'infra/prisma/generated/**',
    'next-env.d.ts',
  ]),
  {
    // Regra de camadas: só os models falam com o banco.
    files: ['src/**/*.{js,jsx}'],
    ignores: ['src/models/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/infra/database',
                'infra/database',
                '**/infra/prisma/generated/**',
                '@prisma/client',
              ],
              message: 'Só src/models/ pode acessar o banco. Use um model.',
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
