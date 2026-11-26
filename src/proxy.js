import { NextResponse } from 'next/server';
import { verifyAccessToken } from 'infra/token';

// Cookie do JWT de acesso (mesmo nome de `controller.ACCESS_COOKIE`; `infra/controller`
// não entra aqui para o proxy não carregar o Zod e o resto da camada de API).
const ACCESS_COOKIE = 'access_token';

// Telas que a pessoa deslogada pode abrir. Comparação exata: `/login-admin` não é pública.
const PUBLIC_PATHS = new Set(['/login', '/signup']);

/**
 * Porta de entrada das telas: sem sessão válida, vai para `/login`.
 * Só autentica (quem é); permissão por rota/grupo continua nos models.
 * Quem já tem sessão passa direto; o 401 de API expirada é tratado pela própria tela.
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

  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  // As rotas de API respondem 401 sozinhas (JSON); assets e PWA não podem ser bloqueados.
  matcher: ['/((?!api/|_next/|favicon\\.ico$|manifest\\.webmanifest$|icons/).*)'],
};
