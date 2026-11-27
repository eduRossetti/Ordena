'use client';

import { Button, Stack } from '@primer/react';
import StatusBanner from '@/components/ui/StatusBanner';
import styles from './ErrorState.module.css';

export default function ErrorState({ error, onRetry }) {
  return (
    <Stack gap="normal" className={styles.container}>
      <StatusBanner variant="critical" title={error?.message ?? 'Não foi possível carregar.'}>
        {error?.action ?? 'Tente novamente em instantes.'}
      </StatusBanner>
      {onRetry ? (
        <Button type="button" size="large" onClick={onRetry} className={styles.retry}>
          Tentar novamente
        </Button>
      ) : null}
    </Stack>
  );
}
