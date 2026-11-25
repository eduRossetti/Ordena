import { NextResponse } from 'next/server';
import { createEdgeRouter } from 'next-connect';
import controller from 'infra/controller';
import session from '@/models/session';

const router = createEdgeRouter();
router.post(postHandler);
router.delete(deleteHandler);

const handler = router.handler(controller.errorHandlers);
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };

async function postHandler(request) {
  const { user, ...tokens } = await session.create(await controller.readJson(request));
  return controller.sessionResponse({ user, expiresAt: tokens.accessExpiresAt }, 201, tokens);
}

async function deleteHandler(request) {
  await session.revoke(controller.readCookie(request, controller.REFRESH_COOKIE));
  return controller.clearSessionCookies(new NextResponse(null, { status: 204 }));
}
