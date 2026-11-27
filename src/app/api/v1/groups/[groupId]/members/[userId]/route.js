import { createEdgeRouter } from 'next-connect';
import controller from 'infra/controller';
import group from '@/models/group';

const router = createEdgeRouter();
router.patch(controller.authenticate, patchHandler);
router.delete(controller.authenticate, deleteHandler);

const handler = router.handler(controller.errorHandlers);
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };

async function patchHandler(request, ctx) {
  const { groupId, userId } = await ctx.params;
  const updated = await group.updateMemberRole(
    ctx.user,
    groupId,
    userId,
    await controller.readJson(request),
  );
  return Response.json(updated, { status: 200 });
}

async function deleteHandler(request, ctx) {
  const { groupId, userId } = await ctx.params;
  await group.removeMember(ctx.user, groupId, userId);
  return new Response(null, { status: 204 });
}
