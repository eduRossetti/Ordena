'use client';

import { BellIcon, PeopleIcon } from '@primer/octicons-react';
import { LinkButton, Text } from '@primer/react';
import NextLink from 'next/link';
import EmptyState from '@/components/ui/EmptyState';
import styles from './WelcomeState.module.css';

export default function WelcomeState() {
  return (
    <EmptyState
      icon={PeopleIcon}
      title="Boas-vindas ao Ordena"
      description="Crie um grupo para organizar tarefas compartilhadas com sua família, casa ou equipe."
    >
      <LinkButton
        as={NextLink}
        href="/group/new"
        variant="primary"
        size="large"
        block
        className={styles.cta}
      >
        Criar grupo
      </LinkButton>

      <div className={styles.notice}>
        <BellIcon size={16} aria-hidden="true" className={styles.noticeIcon} />
        <Text as="p" size="small" className={styles.noticeText}>
          Recebeu um convite? Ele fica no sino de notificações, no topo da tela Tarefas.
        </Text>
      </div>
    </EmptyState>
  );
}
