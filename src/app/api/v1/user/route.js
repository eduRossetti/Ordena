import { createEdgeRouter } from 'next-connect';
import controller from 'infra/controller';
import user from '@/models/user';

const router = createEdgeRouter();
router.get(controller.authenticate, getHandler);

const handler = router.handler(controller.errorHandlers);
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };

async function getHandler(request, ctx) {
  return Response.json(await user.findAuthenticated(ctx.user.id), { status: 200 });
}
