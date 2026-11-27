import BottomNav from '@/components/features/BottomNav';
import UserProvider from '@/components/features/UserProvider';
import styles from './layout.module.css';

export default function AppLayout({ children }) {
  return (
    <UserProvider>
      <div className={styles.shell}>
        <main className={styles.main}>{children}</main>
        <BottomNav />
      </div>
    </UserProvider>
  );
}
