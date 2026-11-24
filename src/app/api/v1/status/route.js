import { createEdgeRouter } from 'next-connect';
import controller from 'infra/controller';
import status from '@/models/status';

const router = createEdgeRouter();
router.get(getHandler);

// Todos os métodos passam pelo router: os não registrados caem no onNoMatch (405).
const handler = router.handler(controller.errorHandlers);
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };

async function getHandler() {
  const statusObject = await status.get();
  return Response.json(statusObject, { status: 200 });
}
