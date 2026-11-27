'use client';

import { createContext, useContext } from 'react';

export const UserContext = createContext(null);

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser deve ser usado dentro de UserProvider.');
  }
  return context;
}
