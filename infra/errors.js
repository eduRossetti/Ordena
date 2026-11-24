/**
 * Erros públicos da API. Models lançam estes erros; `infra/controller.js`
 * os converte em resposta HTTP com `toJSON()`:
 *   { name, message, action, statusCode }
 */
class PublicError extends Error {
  constructor({ name, message, action, statusCode, cause }) {
    super(message, { cause });
    this.name = name;
    this.action = action;
    this.statusCode = statusCode;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      action: this.action,
      statusCode: this.statusCode,
    };
  }
}

export class InternalServerError extends PublicError {
  constructor({ cause, statusCode } = {}) {
    super({
      name: 'InternalServerError',
      message: 'Um erro interno não esperado aconteceu.',
      action: 'Entre em contato com o suporte.',
      statusCode: statusCode || 500,
      cause,
    });
  }
}

export class ValidationError extends PublicError {
  constructor({ cause, message, action } = {}) {
    super({
      name: 'ValidationError',
      message: message || 'Um erro de validação ocorreu.',
      action: action || 'Ajuste os dados enviados e tente novamente.',
      statusCode: 400,
      cause,
    });
  }
}

export class UnauthorizedError extends PublicError {
  constructor({ cause, message, action } = {}) {
    super({
      name: 'UnauthorizedError',
      message: message || 'Usuário não autenticado.',
      action: action || 'Faça novamente o login para continuar.',
      statusCode: 401,
      cause,
    });
  }
}

export class ForbiddenError extends PublicError {
  constructor({ cause, message, action } = {}) {
    super({
      name: 'ForbiddenError',
      message: message || 'Acesso negado.',
      action: action || 'Verifique se você tem permissão para executar esta ação.',
      statusCode: 403,
      cause,
    });
  }
}

export class NotFoundError extends PublicError {
  constructor({ cause, message, action } = {}) {
    super({
      name: 'NotFoundError',
      message: message || 'Não foi possível encontrar este recurso no sistema.',
      action: action || 'Verifique se os parâmetros enviados na consulta estão certos.',
      statusCode: 404,
      cause,
    });
  }
}

export class MethodNotAllowedError extends PublicError {
  constructor() {
    super({
      name: 'MethodNotAllowedError',
      message: 'Método não permitido para este endpoint.',
      action: 'Verifique se o método HTTP enviado é válido para este endpoint.',
      statusCode: 405,
    });
  }
}

export class ConflictError extends PublicError {
  constructor({ cause, message, action } = {}) {
    super({
      name: 'ConflictError',
      message: message || 'Conflito com o estado atual do recurso.',
      action: action || 'Atualize os dados e tente novamente.',
      statusCode: 409,
      cause,
    });
  }
}

export { PublicError };
