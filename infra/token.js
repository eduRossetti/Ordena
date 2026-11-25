import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { UnauthorizedError } from 'infra/errors';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

const ISSUER = 'ordena';
const AUDIENCE = 'ordena';

// Lido sob demanda (não na carga do módulo) para não quebrar o `next build` sem .env.
function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET ausente ou com menos de 32 caracteres.');
  }
  return new TextEncoder().encode(secret);
}

/** JWT de acesso: só identidade. Papéis de grupo são checados no banco pelos models. */
export async function signAccessToken({ id, username, name, sessionId }) {
  return new SignJWT({ username, name, sid: sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(id)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyAccessToken(token) {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return {
      id: payload.sub,
      username: payload.username,
      name: payload.name,
      sessionId: payload.sid,
    };
  } catch (error) {
    throw new UnauthorizedError({
      message: 'Sessão inválida ou expirada.',
      action: 'Faça novamente o login para continuar.',
      cause: error,
    });
  }
}

export function generateRefreshToken() {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}
