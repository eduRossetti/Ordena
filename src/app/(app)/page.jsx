import Greeting from '@/components/features/Greeting';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <main className={styles.main}>
      <Greeting />
    </main>
  );
}
