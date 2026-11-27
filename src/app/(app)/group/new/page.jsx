import CreateGroupForm from '@/components/features/CreateGroupForm';
import PageHeader from '@/components/ui/PageHeader';
import styles from '../../layout.module.css';

export const metadata = { title: 'Criar grupo · Ordena' };

export default function NewGroupPage() {
  return (
    <>
      <PageHeader title="Criar grupo" />
      <div className={styles.section}>
        <CreateGroupForm />
      </div>
    </>
  );
}
