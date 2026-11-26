/**
 * Cliente da API interna (`/api/v1`) para o navegador.
 *
 * Nunca lança: devolve `{ ok: true, status, data }` ou `{ ok: false, status, error }`,
 * com `error` no formato da API: `{ name, message, action, statusCode }`.
 */

const NETWORK_ERROR = {
  name: 'NetworkError',
  message: 'Não foi possível conectar ao Ordena.',
  action: 'Verifique sua conexão com a internet e tente novamente.',
  statusCode: 0,
};

const UNEXPECTED_ERROR = {
  name: 'InternalServerError',
  message: 'Um erro interno não esperado aconteceu.',
  action: 'Tente novamente em instantes.',
};

async function readBody(response) {
  if (response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function apiFetch(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      signal,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return { ok: false, status: 0, error: NETWORK_ERROR };
  }

  const data = await readBody(response);
  if (response.ok) return { ok: true, status: response.status, data };

  const error = data?.message ? data : { ...UNEXPECTED_ERROR, statusCode: response.status };
  return { ok: false, status: response.status, error };
}
