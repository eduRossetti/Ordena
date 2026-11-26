'use client';

import { Button, Link, Stack, Text } from '@primer/react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import FormField from '@/components/ui/FormField';
import PasswordField from '@/components/ui/PasswordField';
import StatusBanner from '@/components/ui/StatusBanner';
import { apiFetch } from '@/lib/api';
import { SIGNUP_EMAIL_KEY } from '@/lib/session-storage-keys';
import { validateSignup } from '@/lib/validation/user';
import styles from './AuthForm.module.css';

const FIELDS = ['name', 'username', 'email', 'password'];
const emptyValues = { name: '', username: '', email: '', password: '' };

export default function SignupForm() {
  const router = useRouter();
  const [values, setValues] = useState(emptyValues);
  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [pending, setPending] = useState(false);
  const formRef = useRef(null);
  const alertRef = useRef(null);

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

    const { data, fieldErrors: errors } = validateSignup(values);
    setFieldErrors(errors);
    setApiError(null);

    const firstInvalid = FIELDS.find((field) => errors[field]);
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }

    setPending(true);
    const result = await apiFetch('/users', { method: 'POST', body: data });

    if (result.ok) {
      try {
        sessionStorage.setItem(SIGNUP_EMAIL_KEY, result.data.email);
      } catch {
        // Sem sessionStorage (modo privado restrito): o login só não vem preenchido.
      }
      router.push('/login?created=1');
      return;
    }

    setPending(false);
    setApiError(result.error);
    // Espera o alerta renderizar para levar o foco (e o leitor de tela) até ele.
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
        ) : null}

        <FormField
          label="Nome"
          autoComplete="name"
          autoCapitalize="words"
          {...fieldProps('name')}
        />
        <FormField
          label="Username"
          hint="De 3 a 30 caracteres: letras, números e _."
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          {...fieldProps('username')}
        />
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
        <PasswordField
          label="Senha"
          hint="De 8 a 72 caracteres."
          autoComplete="new-password"
          {...fieldProps('password')}
        />

        <Button
          type="submit"
          variant="primary"
          size="large"
          block
          loading={pending}
          loadingAnnouncement="Criando conta"
          className={styles.submit}
        >
          Criar conta
        </Button>

        <Text as="p" size="small" className={styles.footer}>
          Já tem conta?{' '}
          <Link as={NextLink} href="/login" className={styles.footerLink}>
            Entrar
          </Link>
        </Text>
      </Stack>
    </form>
  );
}
