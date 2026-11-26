'use client';

import { Button, Link, Stack, Text } from '@primer/react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import FormField from '@/components/ui/FormField';
import PasswordField from '@/components/ui/PasswordField';
import StatusBanner from '@/components/ui/StatusBanner';
import { apiFetch } from '@/lib/api';
import { SIGNUP_EMAIL_KEY } from '@/lib/session-storage-keys';
import { validateLogin } from '@/lib/validation/user';
import styles from './AuthForm.module.css';

const FIELDS = ['email', 'password'];

export default function LoginForm({ created = false }) {
  const router = useRouter();
  const [values, setValues] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [pending, setPending] = useState(false);
  const formRef = useRef(null);
  const alertRef = useRef(null);

  // Depois do cadastro: preenche o e-mail e leva o foco para a senha.
  // Lido no efeito (não no render) para o HTML do servidor e o do navegador baterem.
  // O efeito só lê (idempotente: roda de novo no Strict Mode e na hidratação sem perder o
  // valor); a chave é apagada quando o login dá certo.
  useEffect(() => {
    if (!created) return;
    let email = null;
    try {
      email = sessionStorage.getItem(SIGNUP_EMAIL_KEY);
    } catch {
      return;
    }
    if (!email) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage só existe no navegador
    setValues((current) => (current.email ? current : { ...current, email }));
    focusField('password');
  }, [created]);

  function focusField(name) {
    formRef.current?.elements.namedItem(name)?.focus();
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => (current[name] ? { ...current, [name]: undefined } : current));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (pending) return;

    const { data, fieldErrors: errors } = validateLogin(values);
    setFieldErrors(errors);
    setApiError(null);

    const firstInvalid = FIELDS.find((field) => errors[field]);
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }

    setPending(true);
    const result = await apiFetch('/sessions', { method: 'POST', body: data });

    if (result.ok) {
      try {
        sessionStorage.removeItem(SIGNUP_EMAIL_KEY);
      } catch {
        // Sem sessionStorage: nada a limpar.
      }
      router.replace('/');
      return;
    }

    setPending(false);
    setApiError(result.error);
    if (result.error.name === 'UnauthorizedError') {
      setValues((current) => ({ ...current, password: '' }));
    }
    requestAnimationFrame(() => alertRef.current?.focus());
  }

  function fieldProps(name) {
    return {
      name,
      value: values[name],
      onChange: handleChange,
      error: fieldErrors[name],
    };
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate>
      <Stack gap="normal">
        {apiError ? (
          <StatusBanner ref={alertRef} variant="critical" title={apiError.message}>
            {apiError.action}
          </StatusBanner>
        ) : created ? (
          <StatusBanner variant="success" title="Conta criada.">
            Entre com seu e-mail e senha.
          </StatusBanner>
        ) : null}

        <FormField
          label="E-mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          {...fieldProps('email')}
        />
        <PasswordField label="Senha" autoComplete="current-password" {...fieldProps('password')} />

        <Button
          type="submit"
          variant="primary"
          size="large"
          block
          loading={pending}
          loadingAnnouncement="Entrando"
          className={styles.submit}
        >
          Entrar
        </Button>

        <Text as="p" size="small" className={styles.footer}>
          Não tem conta?{' '}
          <Link as={NextLink} href="/signup" className={styles.footerLink}>
            Criar conta
          </Link>
        </Text>
      </Stack>
    </form>
  );
}
