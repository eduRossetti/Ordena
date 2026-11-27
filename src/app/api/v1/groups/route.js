import { createEdgeRouter } from 'next-connect';
import controller from 'infra/controller';
import group from '@/models/group';

const router = createEdgeRouter();
router.post(controller.authenticate, postHandler);

const handler = router.handler(controller.errorHandlers);
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };

async function postHandler(request, ctx) {
  const created = await group.create(ctx.user, await controller.readJson(request));
  return Response.json(created, { status: 201 });
}
