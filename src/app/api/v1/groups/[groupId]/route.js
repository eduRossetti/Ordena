import { createEdgeRouter } from 'next-connect';
import controller from 'infra/controller';
import group from '@/models/group';

const router = createEdgeRouter();
router.get(controller.authenticate, getHandler);
router.patch(controller.authenticate, patchHandler);
router.delete(controller.authenticate, deleteHandler);

const handler = router.handler(controller.errorHandlers);
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };

async function getHandler(request, ctx) {
  const { groupId } = await ctx.params;
  return Response.json(await group.findOneById(ctx.user, groupId), { status: 200 });
}

async function patchHandler(request, ctx) {
  const { groupId } = await ctx.params;
  const updated = await group.update(ctx.user, groupId, await controller.readJson(request));
  return Response.json(updated, { status: 200 });
}

async function deleteHandler(request, ctx) {
  const { groupId } = await ctx.params;
  await group.remove(ctx.user, groupId);
  return new Response(null, { status: 204 });
}
