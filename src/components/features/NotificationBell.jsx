'use client';

import { BellIcon } from '@primer/octicons-react';
import { IconButton } from '@primer/react';
import styles from './NotificationBell.module.css';

export default function NotificationBell({ onClick }) {
  return (
    <IconButton
      type="button"
      icon={BellIcon}
      variant="invisible"
      size="large"
      aria-label="Notificações"
      aria-disabled={onClick ? undefined : true}
      tooltipDirection="sw"
      onClick={onClick}
      className={styles.button}
    />
  );
}
