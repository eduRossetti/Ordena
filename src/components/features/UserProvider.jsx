'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

  const reload = useCallback(() => {
    // Com dados já carregados, mantém a tela (status 'ready') e só marca `refreshing`.
    setState((current) =>
      current.user
        ? { ...current, refreshing: true }
        : { ...current, status: 'loading', error: null },
    );
    setReloadCount((count) => count + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    apiFetch('/user', { signal: controller.signal })
      .then((result) => {
        if (result.ok) {
          setState({ status: 'ready', user: result.data, error: null, refreshing: false });
        } else if (result.status === 401) {
          router.replace('/login');
        } else {
          setState({ status: 'error', user: null, error: result.error, refreshing: false });
        }
      })
      .catch(() => {
        // Abortado ao desmontar ou ao recarregar: nada a fazer.
      });

    return () => controller.abort();
  }, [reloadCount, router]);

  const value = useMemo(() => ({ ...state, reload }), [state, reload]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
