import { NextResponse } from 'next/server';
import { createEdgeRouter } from 'next-connect';
import controller from 'infra/controller';
import { UnauthorizedError } from 'infra/errors';
import session from '@/models/session';

const router = createEdgeRouter();
router.post(postHandler);

const handler = router.handler(controller.errorHandlers);
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };

async function postHandler(request) {
  try {
    const { user, ...tokens } = await session.refresh(
      controller.readCookie(request, controller.REFRESH_COOKIE),
    );
    return controller.sessionResponse({ user, expiresAt: tokens.accessExpiresAt }, 200, tokens);
  } catch (error) {
    // Sessão inválida: o navegador deve descartar os cookies.
    if (error instanceof UnauthorizedError) {
      return controller.clearSessionCookies(NextResponse.json(error, { status: 401 }));
    }
    throw error;
  }
}
