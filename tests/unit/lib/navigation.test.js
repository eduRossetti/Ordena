import { TABS, isTabActive } from '@/lib/navigation';

describe('TABS', () => {
  test('define as 3 abas principais na ordem esperada', () => {
    expect(TABS.map((tab) => ({ href: tab.href, label: tab.label }))).toEqual([
      { href: '/', label: 'Tarefas' },
      { href: '/group', label: 'Grupo' },
      { href: '/profile', label: 'Perfil' },
    ]);
  });
});

describe('isTabActive', () => {
  test('ativa a raiz "/" apenas no caminho exato "/"', () => {
    expect(isTabActive('/', '/')).toBe(true);
    expect(isTabActive('/group', '/')).toBe(false);
    expect(isTabActive('/profile', '/')).toBe(false);
    expect(isTabActive('/tasks', '/')).toBe(false);
  });

  test('ativa "/group" em "/group" e subcaminhos, mas não em prefixos parecidos', () => {
    expect(isTabActive('/group', '/group')).toBe(true);
    expect(isTabActive('/group/membros', '/group')).toBe(true);
    expect(isTabActive('/group/123/edit', '/group')).toBe(true);
    expect(isTabActive('/groupies', '/group')).toBe(false);
    expect(isTabActive('/', '/group')).toBe(false);
  });

  test('ativa "/profile" em "/profile" e subcaminhos, mas não em prefixos parecidos', () => {
    expect(isTabActive('/profile', '/profile')).toBe(true);
    expect(isTabActive('/profile/editar', '/profile')).toBe(true);
    expect(isTabActive('/profiles', '/profile')).toBe(false);
    expect(isTabActive('/', '/profile')).toBe(false);
  });

  test('retorna false quando pathname é nulo, indefinido ou vazio', () => {
    expect(isTabActive(null, '/')).toBe(false);
    expect(isTabActive(undefined, '/group')).toBe(false);
    expect(isTabActive('', '/profile')).toBe(false);
  });
});
