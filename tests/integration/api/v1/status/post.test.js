import { POST } from '@/app/api/v1/status/route';

describe('POST /api/v1/status', () => {
  test('retorna 405 porque o método não é permitido', async () => {
    const response = await POST(
      new Request('http://localhost/api/v1/status', { method: 'POST' }),
      {},
    );
    expect(response.status).toBe(405);

    const responseBody = await response.json();

    expect(responseBody).toEqual({
      name: 'MethodNotAllowedError',
      message: 'Método não permitido para este endpoint.',
      action: 'Verifique se o método HTTP enviado é válido para este endpoint.',
      statusCode: 405,
    });
  });
});
