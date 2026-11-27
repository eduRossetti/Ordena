'use client';

import { Heading, Stack, Text } from '@primer/react';
import styles from './EmptyState.module.css';

export default function EmptyState({ icon: Icon, title, description, children }) {
  return (
    <div className={styles.container}>
      {Icon ? (
        <span className={styles.icon} aria-hidden="true">
          <Icon size={24} />
        </span>
      ) : null}
      <Stack gap="condensed" align="center" className={styles.copy}>
        <Heading as="h2" variant="small">
          {title}
        </Heading>
        {description ? (
          <Text as="p" className={styles.description}>
            {description}
          </Text>
        ) : null}
      </Stack>
      {children ? <div className={styles.actions}>{children}</div> : null}
    </div>
  );
}
