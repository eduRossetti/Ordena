import { createEdgeRouter } from 'next-connect';
import controller from 'infra/controller';
import group from '@/models/group';

const router = createEdgeRouter();
router.put(controller.authenticate, putHandler);

const handler = router.handler(controller.errorHandlers);
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };

async function putHandler(request, ctx) {
  const { groupId } = await ctx.params;
  const newOwner = await group.transferOwnership(
    ctx.user,
    groupId,
    await controller.readJson(request),
  );
  return Response.json(newOwner, { status: 200 });
}
