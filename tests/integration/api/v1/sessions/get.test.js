import { GET } from '@/app/api/v1/sessions/route';

describe('GET /api/v1/sessions', () => {
  test('retorna 405 porque o método não é permitido', async () => {
    const response = await GET(new Request('http://localhost/api/v1/sessions'), {});
    expect(response.status).toBe(405);
    expect((await response.json()).name).toBe('MethodNotAllowedError');
  });
});
