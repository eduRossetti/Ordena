import { createEdgeRouter } from 'next-connect';
import controller from 'infra/controller';
import invite from '@/models/invite';

const router = createEdgeRouter();
router.patch(controller.authenticate, patchHandler);

const handler = router.handler(controller.errorHandlers);
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };

async function patchHandler(request, ctx) {
  const { inviteId } = await ctx.params;
  const updated = await invite.respond(ctx.user, inviteId, await controller.readJson(request));
  return Response.json(updated, { status: 200 });
}
