import { z, ZodError } from 'zod';
import {
  InternalServerError,
  MethodNotAllowedError,
  PublicError,
  ValidationError,
} from 'infra/errors';

// Mensagens padrão do Zod em português (fallback; nos schemas prefira mensagens explícitas).
z.config(z.locales.pt());

function onNoMatchHandler() {
  const publicErrorObject = new MethodNotAllowedError();
  return Response.json(publicErrorObject, { status: publicErrorObject.statusCode });
}

function onErrorHandler(error) {
  if (error instanceof ZodError) {
    error = new ValidationError({ message: error.issues[0]?.message, cause: error });
  }

  if (error instanceof PublicError && !(error instanceof InternalServerError)) {
    return Response.json(error, { status: error.statusCode });
  }

  const publicErrorObject =
    error instanceof InternalServerError ? error : new InternalServerError({ cause: error });

  console.error(publicErrorObject);

  return Response.json(publicErrorObject, { status: publicErrorObject.statusCode });
}

/**
 * Peças compartilhadas pelos controllers (`src/app/api/v1/**\/route.js`):
 *
 *   const router = createEdgeRouter();
 *   router.get(getHandler);
 *   const handler = router.handler(controller.errorHandlers);
 */
const controller = {
  errorHandlers: {
    onNoMatch: onNoMatchHandler,
    onError: onErrorHandler,
  },
};

export default controller;
