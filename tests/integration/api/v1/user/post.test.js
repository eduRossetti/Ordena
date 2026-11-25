import { POST } from '@/app/api/v1/user/route';

describe('POST /api/v1/user', () => {
  test('retorna 405 (e não 401) porque o método não é permitido', async () => {
    const response = await POST(
      new Request('http://localhost/api/v1/user', { method: 'POST' }),
      {},
    );
    expect(response.status).toBe(405);
    expect((await response.json()).name).toBe('MethodNotAllowedError');
  });
});
