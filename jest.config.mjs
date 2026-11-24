import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const shared = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^infra/(.*)$': '<rootDir>/infra/$1',
  },
};

// next/jest precisa envolver cada projeto para aplicar o transform (SWC).
const unit = createJestConfig({
  ...shared,
  displayName: 'unit',
  testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
});

const integration = createJestConfig({
  ...shared,
  displayName: 'integration',
  testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
  globalSetup: '<rootDir>/tests/integration/global-setup.js',
  setupFiles: ['<rootDir>/tests/integration/setup-env.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/integration/disconnect-prisma.js'],
});

const config = async () => ({
  projects: [await unit(), await integration()],
});

export default config;
