import { z, ZodError } from 'zod';
import { NextResponse } from 'next/server';
import {
  InternalServerError,
  MethodNotAllowedError,
  PublicError,
  UnauthorizedError,
  ValidationError,
} from 'infra/errors';
import { verifyAccessToken } from 'infra/token';

// Mensagens padrão do Zod em português (fallback; nos schemas prefira mensagens explícitas).
z.config(z.locales.pt());

function onNoMatchHandler() {
  const publicErrorObject = new MethodNotAllowedError();
  return Response.json(publicErrorObject, { status: publicErrorObject.statusCode });
}

function onErrorHandler(error) {
  if (error instanceof ZodError) {
    error = new ValidationError({ message: error.issues[0]?.message, cause: error });
  }

  if (error instanceof PublicError && !(error instanceof InternalServerError)) {
    return Response.json(error, { status: error.statusCode });
  }

  const publicErrorObject =
    error instanceof InternalServerError ? error : new InternalServerError({ cause: error });

  console.error(publicErrorObject);

  return Response.json(publicErrorObject, { status: publicErrorObject.statusCode });
}

// Lê o corpo JSON; corpo ausente ou malformado vira ValidationError (400), não 500.
async function readJson(request) {
  try {
    return await request.json();
  } catch (error) {
    throw new ValidationError({
      message: 'O corpo da requisição não é um JSON válido.',
      action: 'Envie um JSON válido.',
      cause: error,
    });
  }
}

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';
// O refresh só viaja para login, refresh e logout.
const REFRESH_COOKIE_PATH = '/api/v1/sessions';

function cookieOptions(path) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path,
  };
}

// Lê o header `Cookie` direto: `new NextRequest(request)` quebra quando o request do Next
// já é um NextRequest (erro de membro privado em runtime), e o Jest não reproduz isso.
function readCookie(request, name) {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1 || part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return undefined;
}

/**
 * Middleware next-connect: exige JWT de acesso válido e põe a identidade em `ctx.user`
 * ({ id, username, name, sessionId }). Só autentica; quem decide permissão é o model.
 */
async function authenticate(request, ctx, next) {
  const token = readCookie(request, ACCESS_COOKIE);
  if (!token) throw new UnauthorizedError();
  ctx.user = await verifyAccessToken(token);
  return next();
}

function clearSessionCookies(response) {
  response.cookies.set(ACCESS_COOKIE, '', { ...cookieOptions('/'), maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, '', { ...cookieOptions(REFRESH_COOKIE_PATH), maxAge: 0 });
  return response;
}

/** Resposta JSON com os cookies de sessão. O token nunca vai no corpo. */
function sessionResponse(
  body,
  status,
  { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt },
) {
  const response = NextResponse.json(body, { status });
  response.cookies.set(ACCESS_COOKIE, accessToken, {
    ...cookieOptions('/'),
    expires: accessExpiresAt,
    maxAge: Math.round((accessExpiresAt - Date.now()) / 1000),
  });
  response.cookies.set(REFRESH_COOKIE, refreshToken, {
    ...cookieOptions(REFRESH_COOKIE_PATH),
    expires: refreshExpiresAt,
    maxAge: Math.round((refreshExpiresAt - Date.now()) / 1000),
  });
  return response;
}

/**
 * Peças compartilhadas pelos controllers (`src/app/api/v1/**\/route.js`):
 *
 *   const router = createEdgeRouter();
 *   router.get(getHandler);
 *   const handler = router.handler(controller.errorHandlers);
 */
const controller = {
  errorHandlers: {
    onNoMatch: onNoMatchHandler,
    onError: onErrorHandler,
  },
  authenticate,
  readJson,
  readCookie,
  sessionResponse,
  clearSessionCookies,
  REFRESH_COOKIE,
};

export default controller;
