import { Heading, Text } from '@primer/react';
import LoginForm from '@/components/features/LoginForm';
import styles from '../layout.module.css';

export const metadata = { title: 'Entrar · Ordena' };

export default async function LoginPage({ searchParams }) {
  const { created } = await searchParams;

  return (
    <>
      <Heading as="h1" variant="medium">
        Entrar
      </Heading>
      <Text as="p" className={styles.subtitle}>
        Acesse as tarefas dos seus grupos.
      </Text>
      <LoginForm created={created === '1'} />
    </>
  );
}
