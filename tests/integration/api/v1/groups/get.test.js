import { DELETE, GET, PATCH, PUT } from '@/app/api/v1/groups/route';

describe('Métodos não permitidos em /api/v1/groups', () => {
  test.each([
    ['GET', GET],
    ['PUT', PUT],
    ['PATCH', PATCH],
    ['DELETE', DELETE],
  ])('%s retorna 405', async (method, handler) => {
    const response = await handler(new Request('http://localhost/api/v1/groups', { method }), {});
    expect(response.status).toBe(405);
    expect((await response.json()).name).toBe('MethodNotAllowedError');
  });
});
