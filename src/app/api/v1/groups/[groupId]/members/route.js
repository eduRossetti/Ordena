import { createEdgeRouter } from 'next-connect';
import controller from 'infra/controller';
import group from '@/models/group';

const router = createEdgeRouter();
router.get(controller.authenticate, getHandler);

const handler = router.handler(controller.errorHandlers);
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };

async function getHandler(request, ctx) {
  const { groupId } = await ctx.params;
  return Response.json(await group.findMembers(ctx.user, groupId), { status: 200 });
}
