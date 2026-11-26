'use client';

import { Spinner, Stack, Text } from '@primer/react';
import { useEffect } from 'react';
import { refreshSession } from '@/lib/api';

/**
 * Destino do proxy quando falta o JWT de acesso. Tenta renovar a sessão com o refresh token:
 * deu certo, segue para a tela pedida; não deu, vai para o login.
 * Navegação completa (`location.replace`) para o proxy já ver os cookies novos.
 * `refreshSession` compartilha a promessa em andamento, então o Strict Mode não renova duas vezes.
 */
export default function RefreshSession({ next }) {
  useEffect(() => {
    let active = true;
    refreshSession().then((ok) => {
      if (active) window.location.replace(ok ? next : '/login');
    });
    return () => {
      active = false;
    };
  }, [next]);

  return (
    <Stack direction="horizontal" align="center" gap="condensed" role="status">
      <Spinner size="small" />
      <Text>Verificando sua sessão…</Text>
    </Stack>
  );
}
