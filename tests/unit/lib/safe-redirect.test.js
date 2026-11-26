import { safeNextPath } from '@/lib/safe-redirect';

describe('safeNextPath', () => {
  test.each([
    ['/', '/'],
    ['/groups/abc', '/groups/abc'],
    ['/groups/abc?tab=tasks#top', '/groups/abc?tab=tasks#top'],
  ])('aceita caminho interno %p', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  test.each([
    undefined,
    null,
    '',
    'groups',
    'https://evil.example/x',
    '//evil.example/x',
    '/\\evil.example',
    'javascript:alert(1)',
    ['/a', '/b'],
  ])('cai na home com valor inseguro ou ausente %p', (input) => {
    expect(safeNextPath(input)).toBe('/');
  });

  test('não devolve para as telas de sessão (evita laço)', () => {
    expect(safeNextPath('/refresh?next=/')).toBe('/');
    expect(safeNextPath('/login')).toBe('/');
    expect(safeNextPath('/signup')).toBe('/');
  });
});
