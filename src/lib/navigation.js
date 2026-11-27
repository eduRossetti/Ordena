export const TABS = [
  { href: '/', label: 'Tarefas', icon: 'checklist' },
  { href: '/group', label: 'Grupo', icon: 'people' },
  { href: '/profile', label: 'Perfil', icon: 'person' },
];

export function isTabActive(pathname, href) {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
