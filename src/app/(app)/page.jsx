'use client';

import { ChecklistIcon, PeopleIcon } from '@primer/octicons-react';
import TasksHeader from '@/components/features/TasksHeader';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import LoadingState from '@/components/ui/LoadingState';
import { useUser } from '@/hooks/useUser';

export default function TasksPage() {
  const { status, user, error, reload } = useUser();
  const groupName = user?.membership?.groupName;

  return (
    <>
      <TasksHeader />

      {status === 'loading' ? (
        <LoadingState />
      ) : status === 'error' ? (
        <ErrorState error={error} onRetry={reload} />
      ) : groupName ? (
        <EmptyState
          icon={ChecklistIcon}
          title={groupName}
          description="Em breve, suas tarefas aparecem aqui."
        />
      ) : (
        <EmptyState
          icon={PeopleIcon}
          title="Você ainda não tem um grupo"
          description="Crie um grupo ou aceite um convite para começar a organizar tarefas."
        />
      )}
    </>
  );
}
