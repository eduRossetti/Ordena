'use client';

import { Heading, Stack, Text } from '@primer/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import StatusBanner from '@/components/ui/StatusBanner';
import { apiFetch } from '@/lib/api';
import styles from './Greeting.module.css';

// Home provisória da área logada: cumprimenta quem está com sessão.
export default function Greeting() {
  const router = useRouter();
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    apiFetch('/user', { signal: controller.signal })
      .then((result) => {
        if (result.ok) setState({ status: 'ready', user: result.data });
        else if (result.status === 401)
          router.replace('/login'); // sessão expirou com a tela aberta
        else setState({ status: 'error', error: result.error });
      })
      .catch(() => {
        // Abortado ao desmontar: nada a fazer.
      });
    return () => controller.abort();
  }, [router]);

  if (state.status === 'loading') {
    return (
      <Text as="p" role="status" className={styles.muted}>
        Carregando…
      </Text>
    );
  }

  if (state.status === 'ready') {
    return (
      <Stack gap="condensed">
        <Heading as="h1" variant="medium">
          Olá, {state.user.name}!
        </Heading>
        <Text as="p" className={styles.muted}>
          Você entrou como{' '}
          <Text weight="semibold" className={styles.username}>
            @{state.user.username}
          </Text>
          . Em breve, seus grupos e tarefas aparecem aqui.
        </Text>
      </Stack>
    );
  }

  return (
    <StatusBanner variant="critical" title={state.error.message}>
      {state.error.action}
    </StatusBanner>
  );
}
