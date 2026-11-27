import { createEdgeRouter } from 'next-connect';
import controller from 'infra/controller';
import task from '@/models/task';

const router = createEdgeRouter();
router.get(controller.authenticate, getHandler);
router.post(controller.authenticate, postHandler);

const handler = router.handler(controller.errorHandlers);
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };

async function getHandler(request, ctx) {
  const { groupId } = await ctx.params;
  const status = new URL(request.url).searchParams.get('status') || undefined;
  return Response.json(await task.findAllByGroupId(ctx.user, groupId, { status }), { status: 200 });
}

async function postHandler(request, ctx) {
  const { groupId } = await ctx.params;
  const created = await task.create(ctx.user, groupId, await controller.readJson(request));
  return Response.json(created, { status: 201 });
}
