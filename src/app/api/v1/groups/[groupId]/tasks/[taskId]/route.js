import { createEdgeRouter } from 'next-connect';
import controller from 'infra/controller';
import task from '@/models/task';

const router = createEdgeRouter();
router.get(controller.authenticate, getHandler);
router.patch(controller.authenticate, patchHandler);
router.delete(controller.authenticate, deleteHandler);

const handler = router.handler(controller.errorHandlers);
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };

async function getHandler(request, ctx) {
  const { groupId, taskId } = await ctx.params;
  return Response.json(await task.findOneById(ctx.user, groupId, taskId), { status: 200 });
}

async function patchHandler(request, ctx) {
  const { groupId, taskId } = await ctx.params;
  const updated = await task.update(ctx.user, groupId, taskId, await controller.readJson(request));
  return Response.json(updated, { status: 200 });
}

async function deleteHandler(request, ctx) {
  const { groupId, taskId } = await ctx.params;
  await task.remove(ctx.user, groupId, taskId);
  return new Response(null, { status: 204 });
}
