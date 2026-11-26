/**
 * Cliente da API interna (`/api/v1`) para o navegador.
 *
 * Renova a sessão sozinho: se uma chamada volta 401, tenta `POST /sessions/refresh` uma vez e
 * repete a chamada. Nunca lança (exceto `AbortError`): devolve `{ ok: true, status, data }` ou
 * `{ ok: false, status, error }`, com `error` no formato da API: `{ name, message, action, statusCode }`.
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

// Rotas em que 401 é a resposta normal (credencial errada, sem sessão): não há o que renovar.
const NO_REFRESH_PREFIXES = ['/sessions', '/users'];

function canRefresh(path) {
  return !NO_REFRESH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

// O refresh token rotaciona: reapresentar um já usado derruba todas as sessões. Por isso só
// uma renovação roda por vez, na aba (promessa compartilhada) e entre abas (Web Locks).
let refreshing = null;

async function postRefresh() {
  try {
    const response = await fetch('/api/v1/sessions/refresh', {
      method: 'POST',
      credentials: 'same-origin',
    });
    return response.ok;
  } catch {
    return false;
  }
}

function withRefreshLock(task) {
  const locks = globalThis.navigator?.locks;
  return locks ? locks.request('ordena:refresh-session', task) : task();
}

/** Troca o refresh token por uma sessão nova. `true` se deu certo; nunca lança. */
export function refreshSession() {
  refreshing ??= withRefreshLock(postRefresh).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function send(path, { method = 'GET', body, signal } = {}) {
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

export async function apiFetch(path, options) {
  const result = await send(path, options);
  if (result.status !== 401 || !canRefresh(path)) return result;

  // Renovou: repete uma vez. Não renovou (ou o 401 persiste): devolve o 401 e quem chamou decide.
  return (await refreshSession()) ? send(path, options) : result;
}
