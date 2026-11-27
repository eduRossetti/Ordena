'use client';

import { Heading, Stack, Text } from '@primer/react';
import WelcomeState from '@/components/features/WelcomeState';
import ErrorState from '@/components/ui/ErrorState';
import LoadingState from '@/components/ui/LoadingState';
import PageHeader from '@/components/ui/PageHeader';
import { useUser } from '@/hooks/useUser';
import styles from '../layout.module.css';

export default function GroupPage() {
  const { status, user, error, reload } = useUser();
  const groupName = user?.membership?.groupName;

  return (
    <>
      <PageHeader title="Grupo" />

      {status === 'loading' ? (
        <LoadingState />
      ) : status === 'error' ? (
        <ErrorState error={error} onRetry={reload} />
      ) : groupName ? (
        <div className={styles.section}>
          <Stack gap="condensed" className={styles.card}>
            <Heading as="h2" variant="small">
              {groupName}
            </Heading>
            <Text as="p" className={styles.muted}>
              Em breve, os detalhes e membros do grupo aparecem aqui.
            </Text>
          </Stack>
        </div>
      ) : (
        <WelcomeState />
      )}
    </>
  );
}
