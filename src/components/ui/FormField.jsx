'use client';

import { FormControl, TextInput } from '@primer/react';
import styles from './FormField.module.css';

/**
 * Campo de texto com label, dica opcional e mensagem de erro.
 * Aceita props de `TextInput` (como `trailingAction`, `type`, `autoComplete`) e `ref`.
 */
export default function FormField({
  label,
  hint,
  error,
  id,
  className,
  ref,
  size = 'large',
  ...inputProps
}) {
  return (
    <FormControl id={id} className={className}>
      <FormControl.Label>{label}</FormControl.Label>
      <TextInput
        ref={ref}
        block
        size={size}
        className={styles.input}
        validationStatus={error ? 'error' : undefined}
        {...inputProps}
      />
      {hint ? <FormControl.Caption>{hint}</FormControl.Caption> : null}
      {error ? <FormControl.Validation variant="error">{error}</FormControl.Validation> : null}
    </FormControl>
  );
}
