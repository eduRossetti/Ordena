'use client';

import { ChecklistIcon } from '@primer/octicons-react';
import TasksHeader from '@/components/features/TasksHeader';
import WelcomeState from '@/components/features/WelcomeState';
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
        <WelcomeState />
      )}
    </>
  );
}
