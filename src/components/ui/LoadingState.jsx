'use client';

import { Spinner, Text } from '@primer/react';
import styles from './LoadingState.module.css';

export default function LoadingState({ label = 'Carregando…' }) {
  return (
    <div role="status" className={styles.container}>
      <Spinner size="medium" srText={null} />
      <Text as="p" className={styles.label}>
        {label}
      </Text>
    </div>
  );
}
