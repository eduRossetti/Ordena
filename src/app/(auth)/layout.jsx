import { Heading, Stack } from '@primer/react';
import Image from 'next/image';
import styles from './layout.module.css';

export default function AuthLayout({ children }) {
  return (
    <main className={styles.main}>
      <Stack direction="horizontal" align="center" gap="condensed" className={styles.brand}>
        <Image src="/icons/icon-192.png" alt="" width={40} height={40} className={styles.icon} />
        <Heading as="h2" variant="small">
          Ordena
        </Heading>
      </Stack>
      {children}
    </main>
  );
}
