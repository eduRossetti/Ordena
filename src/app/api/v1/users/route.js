import { createEdgeRouter } from 'next-connect';
import controller from 'infra/controller';
import user from '@/models/user';

const router = createEdgeRouter();
router.post(postHandler);

const handler = router.handler(controller.errorHandlers);
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };

async function postHandler(request) {
  const newUser = await user.create(await controller.readJson(request));
  return Response.json(newUser, { status: 201 });
}
