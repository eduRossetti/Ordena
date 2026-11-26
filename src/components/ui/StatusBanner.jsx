'use client';

import { Banner } from '@primer/react';
import styles from './StatusBanner.module.css';

/**
 * Wrapper acessível sobre o `Banner` do Primer.
 * `critical` anuncia imediatamente (`role="alert"`); demais variantes usam `role="status"`.
 * Aceita `ref` para receber foco programático após envio de formulário.
 */
export default function StatusBanner({
  variant = 'critical',
  title,
  description,
  children,
  className,
  ref,
}) {
  const classes = className ? `${styles.wrapper} ${className}` : styles.wrapper;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role={variant === 'critical' ? 'alert' : 'status'}
      className={classes}
    >
      <Banner
        variant={variant}
        layout="compact"
        title={title}
        description={description ?? children}
      />
    </div>
  );
}
