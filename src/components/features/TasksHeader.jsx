'use client';

import NotificationBell from '@/components/features/NotificationBell';
import PageHeader from '@/components/ui/PageHeader';

export default function TasksHeader({ onNotificationsClick }) {
  return (
    <PageHeader title="Tarefas">
      <NotificationBell onClick={onNotificationsClick} />
    </PageHeader>
  );
}
