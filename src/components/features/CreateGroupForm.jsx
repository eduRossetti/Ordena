'use client';

import { Button, Stack } from '@primer/react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import FormField from '@/components/ui/FormField';
import StatusBanner from '@/components/ui/StatusBanner';
import TextareaField from '@/components/ui/TextareaField';
import { useUser } from '@/hooks/useUser';
import { apiFetch } from '@/lib/api';
import { GROUP_DESCRIPTION_MAX_LENGTH, validateCreateGroup } from '@/lib/validation/group';
import styles from './CreateGroupForm.module.css';

const FIELDS = ['name', 'description'];
const emptyValues = { name: '', description: '' };

export default function CreateGroupForm() {
  const router = useRouter();
  const { reload } = useUser();
  const [values, setValues] = useState(emptyValues);
  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [pending, setPending] = useState(false);
  // O grupo já foi criado (201); falta só atualizar os dados da pessoa.
  const [created, setCreated] = useState(false);
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

  function handleCancel() {
    if (pending) return;
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/group');
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (pending) return;

    if (created) {
      setApiError(null);
      await syncAndLeave();
      return;
    }

    const { data, fieldErrors: errors } = validateCreateGroup(values);
    setFieldErrors(errors);
    setApiError(null);

    const firstInvalid = FIELDS.find((field) => errors[field]);
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }

    setPending(true);
    const result = await apiFetch('/groups', { method: 'POST', body: data });

    if (result.ok) {
      setCreated(true);
      await syncAndLeave();
      return;
    }

    if (result.status === 401) {
      router.replace('/login');
      return;
    }

    // 409: a pessoa já tem grupo e o contexto está desatualizado; atualiza em segundo plano
    // para Tarefas e Grupo pararem de mostrar as boas-vindas.
    if (result.status === 409) reload();

    showError(result.error);
  }

  function showError(error) {
    setPending(false);
    setApiError(error);
    requestAnimationFrame(() => alertRef.current?.focus());
  }

  // Atualiza `membership` e só então vai para Tarefas. Se `GET /user` falhar, o grupo já
  // existe: avisa e deixa tentar de novo (reenviar o POST daria 409).
  async function syncAndLeave() {
    setPending(true);
    const reloaded = await reload();

    // `null`: a tela foi desmontada (o provider já decidiu para onde ir). 401: o provider
    // já redirecionou para o login.
    if (!reloaded || reloaded.status === 401) return;

    if (reloaded.ok) {
      router.replace('/');
      return;
    }

    showError({
      message: 'Seu grupo foi criado, mas não conseguimos carregá-lo.',
      action: reloaded.error?.action ?? 'Tente novamente em instantes.',
    });
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
          label="Nome do grupo"
          hint="Até 50 caracteres."
          autoCapitalize="sentences"
          {...fieldProps('name')}
        />

        <TextareaField
          label="Descrição (opcional)"
          rows={4}
          maxLength={GROUP_DESCRIPTION_MAX_LENGTH}
          {...fieldProps('description')}
        />

        <Stack gap="condensed" className={styles.actions}>
          <Button
            type="submit"
            variant="primary"
            size="large"
            block
            loading={pending}
            loadingAnnouncement={created ? 'Carregando seu grupo' : 'Criando grupo'}
            className={styles.actionButton}
          >
            {created ? 'Tentar novamente' : 'Criar grupo'}
          </Button>
          <Button
            type="button"
            variant="invisible"
            size="large"
            block
            onClick={handleCancel}
            className={styles.actionButton}
          >
            Cancelar
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}
