import { createEdgeRouter } from 'next-connect';
import controller from 'infra/controller';
import invite from '@/models/invite';

const router = createEdgeRouter();
router.delete(controller.authenticate, deleteHandler);

const handler = router.handler(controller.errorHandlers);
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };

async function deleteHandler(request, ctx) {
  const { groupId, inviteId } = await ctx.params;
  await invite.cancel(ctx.user, groupId, inviteId);
  return new Response(null, { status: 204 });
}
