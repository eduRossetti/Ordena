'use client';

import { Heading, Stack, Text } from '@primer/react';
import PageHeader from '@/components/ui/PageHeader';
import ErrorState from '@/components/ui/ErrorState';
import LoadingState from '@/components/ui/LoadingState';
import { useUser } from '@/hooks/useUser';
import styles from '../layout.module.css';

export default function ProfilePage() {
  const { status, user, error, reload } = useUser();

  return (
    <>
      <PageHeader title="Perfil" />

      {status === 'loading' ? (
        <LoadingState />
      ) : status === 'error' ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <div className={styles.section}>
          <Stack gap="condensed" className={styles.card}>
            <Heading as="h2" variant="small">
              {user.name}
            </Heading>
            <Text as="p" className={styles.muted}>
              @{user.username}
            </Text>
          </Stack>
        </div>
      )}
    </>
  );
}
