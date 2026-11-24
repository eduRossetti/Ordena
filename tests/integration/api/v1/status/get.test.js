import { GET } from '@/app/api/v1/status/route';

describe('GET /api/v1/status', () => {
  test('retorna 200 com o status atual do sistema', async () => {
    const response = await GET(new Request('http://localhost/api/v1/status'), {});
    expect(response.status).toBe(200);

    const responseBody = await response.json();

    expect(responseBody).toEqual({
      updatedAt: expect.any(String),
      dependencies: {
        database: {
          version: expect.any(String),
          maxConnections: expect.any(Number),
          openedConnections: expect.any(Number),
        },
      },
    });
    expect(new Date(responseBody.updatedAt).toISOString()).toBe(responseBody.updatedAt);
    expect(responseBody.dependencies.database.openedConnections).toBeGreaterThan(0);
  });
});
