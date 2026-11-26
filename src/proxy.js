import { NextResponse } from 'next/server';
import { verifyAccessToken } from 'infra/token';

// Cookie do JWT de acesso (mesmo nome de `controller.ACCESS_COOKIE`; `infra/controller`
// não entra aqui para o proxy não carregar o Zod e o resto da camada de API).
const ACCESS_COOKIE = 'access_token';

// Telas que a pessoa deslogada pode abrir. Comparação exata: `/login-admin` não é pública.
// `/refresh` renova a sessão: só nela (via fetch a /api/v1/sessions) o navegador envia o refresh
// token, que tem Path=/api/v1/sessions e por isso nunca chega aqui no proxy.
const PUBLIC_PATHS = new Set(['/login', '/signup', '/refresh']);

/**
 * Porta de entrada das telas. JWT de acesso válido: passa. Sem ele (ausente, inválido ou
 * vencido): vai para `/refresh?next=<tela>`, que tenta renovar a sessão com o refresh token e,
 * se não der, leva ao `/login`. Só autentica; permissão por rota/grupo fica nos models.
 */
export async function proxy(request) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (token) {
    try {
      await verifyAccessToken(token);
      return NextResponse.next();
    } catch {
      // Token inválido ou expirado: cai no redirecionamento abaixo.
    }
  }

  const refreshUrl = new URL('/refresh', request.url);
  refreshUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(refreshUrl);
}

export const config = {
  // As rotas de API respondem 401 sozinhas (JSON); assets e PWA não podem ser bloqueados.
  matcher: ['/((?!api/|_next/|favicon\\.ico$|manifest\\.webmanifest$|icons/).*)'],
};
