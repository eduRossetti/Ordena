'use client';

import { Heading } from '@primer/react';
import styles from './PageHeader.module.css';

// Cabeçalho das telas da área logada: título (h1) e, opcionalmente, uma ação à direita.
export default function PageHeader({ title, children }) {
  return (
    <header className={styles.header}>
      <Heading as="h1" variant="medium" className={styles.title}>
        {title}
      </Heading>
      {children}
    </header>
  );
}
