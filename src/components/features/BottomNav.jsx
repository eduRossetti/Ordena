'use client';

import { ChecklistIcon, PeopleIcon, PersonIcon } from '@primer/octicons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TABS, isTabActive } from '@/lib/navigation';
import styles from './BottomNav.module.css';

const TAB_ICONS = {
  checklist: ChecklistIcon,
  people: PeopleIcon,
  person: PersonIcon,
};

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className={styles.nav}>
      <ul className={styles.list}>
        {TABS.map((tab) => {
          const active = isTabActive(pathname, tab.href);
          const Icon = TAB_ICONS[tab.icon];

          return (
            <li key={tab.href} className={styles.item}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={active ? `${styles.link} ${styles.active}` : styles.link}
              >
                <Icon size={20} aria-hidden="true" />
                <span className={styles.label}>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
