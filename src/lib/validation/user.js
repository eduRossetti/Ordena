/**
 * Validação no navegador dos formulários de cadastro e login.
 *
 * Espelha `createSchema` (src/models/user.js) e `loginSchema` (src/models/session.js):
 * mudou uma regra ou mensagem lá, mude aqui também. A API continua sendo quem decide;
 * isto só antecipa o erro para mostrá-lo no campo.
 */

// Mesmo padrão do `z.email()` do Zod 4, para cliente e API concordarem.
const EMAIL_PATTERN =
  /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
const USERNAME_PATTERN = /^[a-z0-9_]+$/;

const PASSWORD_LENGTH_MESSAGE = 'A senha deve ter de 8 a 72 caracteres.';
const USERNAME_LENGTH_MESSAGE = 'O username deve ter de 3 a 30 caracteres.';

function asString(value) {
  return typeof value === 'string' ? value : '';
}

function normalizeEmail(value) {
  return asString(value).trim().toLowerCase();
}

function emailError(email) {
  if (!email) return 'Informe o e-mail.';
  if (!EMAIL_PATTERN.test(email)) return 'Informe um e-mail válido.';
  return undefined;
}

function nameError(name) {
  if (!name) return 'Informe o nome.';
  if (name.length > 80) return 'O nome deve ter no máximo 80 caracteres.';
  return undefined;
}

function usernameError(username) {
  if (!username) return 'Informe o username.';
  if (username.length < 3 || username.length > 30) return USERNAME_LENGTH_MESSAGE;
  if (!USERNAME_PATTERN.test(username)) return 'O username só pode ter letras, números e _.';
  return undefined;
}

function newPasswordError(password) {
  if (!password) return 'Informe a senha.';
  if (password.length < 8 || password.length > 72) return PASSWORD_LENGTH_MESSAGE;
  return undefined;
}

function currentPasswordError(password) {
  if (!password) return 'Informe a senha.';
  if (password.length > 72) return PASSWORD_LENGTH_MESSAGE;
  return undefined;
}

// Monta `{ campo: mensagem }` só com os campos que têm erro.
function collectErrors(errors) {
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message));
}

/** Devolve `data` já normalizado (como a API normaliza) e `fieldErrors` ({} se válido). */
export function validateSignup(values = {}) {
  const data = {
    name: asString(values.name).trim(),
    username: asString(values.username).trim().toLowerCase(),
    email: normalizeEmail(values.email),
    password: asString(values.password),
  };

  const fieldErrors = collectErrors({
    name: nameError(data.name),
    username: usernameError(data.username),
    email: emailError(data.email),
    password: newPasswordError(data.password),
  });

  return { data, fieldErrors };
}

export function validateLogin(values = {}) {
  const data = { email: normalizeEmail(values.email), password: asString(values.password) };

  const fieldErrors = collectErrors({
    email: emailError(data.email),
    password: currentPasswordError(data.password),
  });

  return { data, fieldErrors };
}
