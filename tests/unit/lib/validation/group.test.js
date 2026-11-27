import { validateCreateGroup } from '@/lib/validation/group';

describe('validateCreateGroup', () => {
  test('aceita nome e descrição válidos sem erros', () => {
    const { data, fieldErrors } = validateCreateGroup({
      name: 'Casa da Praia',
      description: 'Tarefas da viagem de fim de semana.',
    });
    expect(fieldErrors).toEqual({});
    expect(data).toEqual({
      name: 'Casa da Praia',
      description: 'Tarefas da viagem de fim de semana.',
    });
  });

  test('normaliza espaços nas pontas de nome e descrição', () => {
    const { data, fieldErrors } = validateCreateGroup({
      name: '  Casa da Praia  ',
      description: '  Lista compartilhada  ',
    });
    expect(fieldErrors).toEqual({});
    expect(data).toEqual({
      name: 'Casa da Praia',
      description: 'Lista compartilhada',
    });
  });

  test('rejeita nome vazio ou só com espaços', () => {
    expect(validateCreateGroup({ name: '' }).fieldErrors).toEqual({
      name: 'Informe o nome do grupo.',
    });
    expect(validateCreateGroup({ name: '   ' }).fieldErrors).toEqual({
      name: 'Informe o nome do grupo.',
    });
  });

  test('valida limite de 50 caracteres no nome (UTF-16)', () => {
    expect(validateCreateGroup({ name: 'a'.repeat(50) }).fieldErrors).toEqual({});
    expect(validateCreateGroup({ name: 'a'.repeat(51) }).fieldErrors).toEqual({
      name: 'O nome do grupo deve ter no máximo 50 caracteres.',
    });
    expect(validateCreateGroup({ name: '🎉'.repeat(25) }).fieldErrors).toEqual({});
    expect(validateCreateGroup({ name: '🎉'.repeat(26) }).fieldErrors).toEqual({
      name: 'O nome do grupo deve ter no máximo 50 caracteres.',
    });
  });

  test('converte descrição ausente, vazia ou só espaços em null sem erro', () => {
    for (const description of [undefined, null, '', '   ']) {
      const { data, fieldErrors } = validateCreateGroup({ name: 'Casa', description });
      expect(fieldErrors).toEqual({});
      expect(data.description).toBeNull();
    }
  });

  test('valida limite de 500 caracteres na descrição (UTF-16)', () => {
    expect(validateCreateGroup({ name: 'Casa', description: 'a'.repeat(500) }).fieldErrors).toEqual(
      {},
    );
    expect(validateCreateGroup({ name: 'Casa', description: 'a'.repeat(501) }).fieldErrors).toEqual(
      {
        description: 'A descrição deve ter no máximo 500 caracteres.',
      },
    );
  });

  test('não quebra com valores ausentes ou não-string', () => {
    expect(validateCreateGroup().fieldErrors).toEqual({
      name: 'Informe o nome do grupo.',
    });
    expect(validateCreateGroup({ name: undefined, description: 123 })).toEqual({
      data: { name: '', description: null },
      fieldErrors: { name: 'Informe o nome do grupo.' },
    });
  });
});
