// Telas de sessão: nunca são destino de um redirecionamento pós-renovação (evita laço).
const SESSION_PATHS = new Set(['/login', '/signup', '/refresh']);

/**
 * Valida o destino `?next=` de /refresh: só caminho interno do próprio app.
 * Qualquer coisa suspeita (URL absoluta, `//host`, `/\host`, `javascript:`) vira a home.
 */
export function safeNextPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/';
  if (value.startsWith('//') || value.startsWith('/\\')) return '/';

  let url;
  try {
    url = new URL(value, 'http://ordena.local');
  } catch {
    return '/';
  }
  if (url.origin !== 'http://ordena.local') return '/';
  if (SESSION_PATHS.has(url.pathname)) return '/';

  return `${url.pathname}${url.search}${url.hash}`;
}
