'use client';

import { Heading, LinkButton, Stack, Text } from '@primer/react';
import NextLink from 'next/link';
import { useEffect, useState } from 'react';
import StatusBanner from '@/components/ui/StatusBanner';
import { apiFetch } from '@/lib/api';
import styles from './Greeting.module.css';

// Home provisória da área logada: cumprimenta quem está com sessão.
export default function Greeting() {
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    apiFetch('/user', { signal: controller.signal })
      .then((result) => {
        if (result.ok) setState({ status: 'ready', user: result.data });
        else if (result.status === 401) setState({ status: 'anonymous' });
        else setState({ status: 'error', error: result.error });
      })
      .catch(() => {
        // Abortado ao desmontar: nada a fazer.
      });
    return () => controller.abort();
  }, []);

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

  if (state.status === 'error') {
    return (
      <StatusBanner variant="critical" title={state.error.message}>
        {state.error.action}
      </StatusBanner>
    );
  }

  return (
    <Stack gap="normal">
      <Stack gap="condensed">
        <Heading as="h1" variant="medium">
          Você não está conectado
        </Heading>
        <Text as="p" className={styles.muted}>
          Entre ou crie uma conta para ver as tarefas dos seus grupos.
        </Text>
      </Stack>
      <Stack direction="horizontal" gap="condensed">
        <LinkButton
          as={NextLink}
          href="/login"
          variant="primary"
          size="large"
          className={styles.action}
        >
          Entrar
        </LinkButton>
        <LinkButton as={NextLink} href="/signup" size="large" className={styles.action}>
          Criar conta
        </LinkButton>
      </Stack>
    </Stack>
  );
}
