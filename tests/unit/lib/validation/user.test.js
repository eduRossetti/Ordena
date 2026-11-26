import { validateLogin, validateSignup } from '@/lib/validation/user';

const validSignup = {
  name: 'Maria Silva',
  username: 'maria_silva',
  email: 'maria@example.com',
  password: 'senha-forte-123',
};

describe('validateSignup', () => {
  test('aceita dados válidos sem erros', () => {
    const { fieldErrors, data } = validateSignup(validSignup);
    expect(fieldErrors).toEqual({});
    expect(data).toEqual(validSignup);
  });

  test('normaliza como a API: trim no nome, trim e minúsculas no username e no e-mail', () => {
    const { fieldErrors, data } = validateSignup({
      name: '  Maria Silva  ',
      username: '  Maria_Silva ',
      email: ' Maria@Example.COM ',
      password: ' senha com espaços ',
    });
    expect(fieldErrors).toEqual({});
    expect(data).toEqual({
      name: 'Maria Silva',
      username: 'maria_silva',
      email: 'maria@example.com',
      password: ' senha com espaços ',
    });
  });

  test('aponta todos os campos vazios de uma vez', () => {
    const { fieldErrors } = validateSignup({ name: '', username: '', email: '', password: '' });
    expect(fieldErrors).toEqual({
      name: 'Informe o nome.',
      username: 'Informe o username.',
      email: 'Informe o e-mail.',
      password: 'Informe a senha.',
    });
  });

  test('trata campos ausentes ou só com espaços como vazios', () => {
    const { fieldErrors } = validateSignup({ name: '   ', username: '  ' });
    expect(fieldErrors).toEqual({
      name: 'Informe o nome.',
      username: 'Informe o username.',
      email: 'Informe o e-mail.',
      password: 'Informe a senha.',
    });
  });

  test('nome com mais de 80 caracteres', () => {
    expect(validateSignup({ ...validSignup, name: 'a'.repeat(80) }).fieldErrors).toEqual({});
    expect(validateSignup({ ...validSignup, name: 'a'.repeat(81) }).fieldErrors).toEqual({
      name: 'O nome deve ter no máximo 80 caracteres.',
    });
  });

  test.each([
    ['ab', 'O username deve ter de 3 a 30 caracteres.'],
    ['a'.repeat(31), 'O username deve ter de 3 a 30 caracteres.'],
    ['maria.silva', 'O username só pode ter letras, números e _.'],
    ['maria silva', 'O username só pode ter letras, números e _.'],
    ['joão', 'O username só pode ter letras, números e _.'],
  ])('username inválido %p', (username, message) => {
    expect(validateSignup({ ...validSignup, username }).fieldErrors).toEqual({ username: message });
  });

  test.each(['abc', 'a'.repeat(30), 'user_123'])('username válido %p', (username) => {
    expect(validateSignup({ ...validSignup, username }).fieldErrors).toEqual({});
  });

  test.each(['maria', 'maria@', 'maria@example', '@example.com', 'maria @example.com'])(
    'e-mail inválido %p',
    (email) => {
      expect(validateSignup({ ...validSignup, email }).fieldErrors).toEqual({
        email: 'Informe um e-mail válido.',
      });
    },
  );

  test('senha precisa ter de 8 a 72 caracteres', () => {
    const message = 'A senha deve ter de 8 a 72 caracteres.';
    expect(validateSignup({ ...validSignup, password: '1234567' }).fieldErrors).toEqual({
      password: message,
    });
    expect(validateSignup({ ...validSignup, password: 'a'.repeat(73) }).fieldErrors).toEqual({
      password: message,
    });
    expect(validateSignup({ ...validSignup, password: '12345678' }).fieldErrors).toEqual({});
    expect(validateSignup({ ...validSignup, password: 'a'.repeat(72) }).fieldErrors).toEqual({});
  });
});

describe('validateLogin', () => {
  test('aceita e-mail e senha, com trim e minúsculas no e-mail', () => {
    const { fieldErrors, data } = validateLogin({ email: ' Maria@Example.com ', password: 'x' });
    expect(fieldErrors).toEqual({});
    expect(data).toEqual({ email: 'maria@example.com', password: 'x' });
  });

  test('aponta campos vazios', () => {
    expect(validateLogin({ email: '', password: '' }).fieldErrors).toEqual({
      email: 'Informe o e-mail.',
      password: 'Informe a senha.',
    });
  });

  test('e-mail inválido', () => {
    expect(validateLogin({ email: 'maria', password: 'x' }).fieldErrors).toEqual({
      email: 'Informe um e-mail válido.',
    });
  });

  test('senha acima de 72 caracteres', () => {
    expect(
      validateLogin({ email: 'maria@example.com', password: 'a'.repeat(73) }).fieldErrors,
    ).toEqual({ password: 'A senha deve ter de 8 a 72 caracteres.' });
  });
});
