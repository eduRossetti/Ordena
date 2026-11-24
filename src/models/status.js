import { prisma } from 'infra/database';

async function get() {
  const [{ version, maxConnections, openedConnections }] = await prisma.$queryRaw`
    SELECT
      current_setting('server_version') AS "version",
      current_setting('max_connections')::int AS "maxConnections",
      (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database()) AS "openedConnections"
  `;

  return {
    updatedAt: new Date().toISOString(),
    dependencies: {
      database: { version, maxConnections, openedConnections },
    },
  };
}

const status = {
  get,
};

export default status;
