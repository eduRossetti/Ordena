import { createEdgeRouter } from 'next-connect';
import controller from 'infra/controller';
import invite from '@/models/invite';

const router = createEdgeRouter();
router.get(controller.authenticate, getHandler);
router.post(controller.authenticate, postHandler);

const handler = router.handler(controller.errorHandlers);
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };

async function getHandler(request, ctx) {
  const { groupId } = await ctx.params;
  return Response.json(await invite.findPendingByGroupId(ctx.user, groupId), { status: 200 });
}

async function postHandler(request, ctx) {
  const { groupId } = await ctx.params;
  const created = await invite.create(ctx.user, groupId, await controller.readJson(request));
  return Response.json(created, { status: 201 });
}
