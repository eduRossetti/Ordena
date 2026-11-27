'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UserContext } from '@/hooks/useUser';
import { apiFetch } from '@/lib/api';

export default function UserProvider({ children }) {
  const router = useRouter();
  const [reloadCount, setReloadCount] = useState(0);
  const [state, setState] = useState({
    status: 'loading',
    user: null,
    error: null,
    refreshing: false,
  });
  const pendingResolversRef = useRef([]);

  const reload = useCallback(() => {
    return new Promise((resolve) => {
      pendingResolversRef.current.push(resolve);
      // Com dados já carregados, mantém a tela (status 'ready') e só marca `refreshing`.
      setState((current) =>
        current.user
          ? { ...current, refreshing: true }
          : { ...current, status: 'loading', error: null },
      );
      setReloadCount((count) => count + 1);
    });
  }, []);

  useEffect(() => {
    // O array é o mesmo durante toda a vida do provider (só é esvaziado com `splice`).
    const resolvers = pendingResolversRef.current;
    return () => {
      // Desmontou: quem espera recebe `null` e não deve navegar (`reload()` só devolve
      // o resultado de `GET /user` quando a resposta chegou de fato).
      for (const resolve of resolvers.splice(0)) resolve(null);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    function flushResolvers(result) {
      const resolvers = pendingResolversRef.current.splice(0);
      for (const resolve of resolvers) resolve(result);
    }

    apiFetch('/user', { signal: controller.signal })
      .then((result) => {
        // Abortado por um reload mais novo: a resposta é velha, só a mais recente vale.
        if (controller.signal.aborted) return;
        if (result.ok) {
          setState({ status: 'ready', user: result.data, error: null, refreshing: false });
        } else if (result.status === 401) {
          router.replace('/login');
        } else {
          setState({ status: 'error', user: null, error: result.error, refreshing: false });
        }
        flushResolvers(result);
      })
      .catch(() => {
        // Abortado ao desmontar ou ao recarregar: se foi outro reload, os resolvers
        // ficam na fila e serão concluídos quando a requisição mais recente terminar.
      });

    return () => controller.abort();
  }, [reloadCount, router]);

  const value = useMemo(() => ({ ...state, reload }), [state, reload]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
