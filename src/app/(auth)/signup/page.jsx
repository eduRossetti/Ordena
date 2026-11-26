import { Heading, Text } from '@primer/react';
import SignupForm from '@/components/features/SignupForm';
import styles from '../layout.module.css';

export const metadata = { title: 'Criar conta · Ordena' };

export default function SignupPage() {
  return (
    <>
      <Heading as="h1" variant="medium">
        Criar conta
      </Heading>
      <Text as="p" className={styles.subtitle}>
        Organize as tarefas do seu grupo.
      </Text>
      <SignupForm />
    </>
  );
}
