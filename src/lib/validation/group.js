/**
 * Validação no navegador do formulário de criação de grupo.
 *
 * Espelha `createSchema` (src/models/group.js): mudou uma regra ou mensagem lá,
 * mude aqui também. A API continua sendo quem decide; isto só antecipa o erro
 * para mostrá-lo no campo.
 */

export const GROUP_NAME_MAX_LENGTH = 50;
export const GROUP_DESCRIPTION_MAX_LENGTH = 500;

function asString(value) {
  return typeof value === 'string' ? value : '';
}

function nameError(name) {
  if (!name) return 'Informe o nome do grupo.';
  if (name.length > GROUP_NAME_MAX_LENGTH) {
    return `O nome do grupo deve ter no máximo ${GROUP_NAME_MAX_LENGTH} caracteres.`;
  }
  return undefined;
}

function descriptionError(description) {
  if (description && description.length > GROUP_DESCRIPTION_MAX_LENGTH) {
    return `A descrição deve ter no máximo ${GROUP_DESCRIPTION_MAX_LENGTH} caracteres.`;
  }
  return undefined;
}

function collectErrors(errors) {
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message));
}

/** Devolve `data` já normalizado (como a API normaliza) e `fieldErrors` ({} se válido). */
export function validateCreateGroup(values = {}) {
  const name = asString(values?.name).trim();
  const trimmedDescription = asString(values?.description).trim();
  const description = trimmedDescription === '' ? null : trimmedDescription;

  const data = { name, description };
  const fieldErrors = collectErrors({
    name: nameError(data.name),
    description: descriptionError(data.description),
  });

  return { data, fieldErrors };
}
