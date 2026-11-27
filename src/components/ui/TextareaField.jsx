'use client';

import { FormControl, Textarea } from '@primer/react';
import styles from './TextareaField.module.css';

/**
 * Campo multilinha com label, dica opcional, contador informativo e mensagem de erro.
 * `maxLength` apenas exibe o contador (sem cortar o texto), para a validação mostrar o erro.
 */
export default function TextareaField({
  label,
  hint,
  error,
  id,
  className,
  ref,
  rows = 4,
  value = '',
  maxLength,
  ...textareaProps
}) {
  const count = typeof value === 'string' ? value.length : 0;
  const hasCounter = typeof maxLength === 'number';
  const overLimit = hasCounter && count > maxLength;

  return (
    <FormControl id={id} className={className}>
      <FormControl.Label>{label}</FormControl.Label>
      <Textarea
        ref={ref}
        block
        resize="vertical"
        rows={rows}
        value={value}
        className={styles.textarea}
        validationStatus={error ? 'error' : undefined}
        {...textareaProps}
      />
      {hint || hasCounter ? (
        <FormControl.Caption className={styles.caption}>
          {hint ? <span>{hint}</span> : null}
          {hasCounter ? (
            <span className={overLimit ? `${styles.counter} ${styles.overLimit}` : styles.counter}>
              {count}/{maxLength}
            </span>
          ) : null}
        </FormControl.Caption>
      ) : null}
      {error ? <FormControl.Validation variant="error">{error}</FormControl.Validation> : null}
    </FormControl>
  );
}
