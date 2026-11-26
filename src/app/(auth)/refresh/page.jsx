import RefreshSession from '@/components/features/RefreshSession';
import { safeNextPath } from '@/lib/safe-redirect';

export const metadata = { title: 'Renovando sessão · Ordena' };

export default async function RefreshPage({ searchParams }) {
  const { next } = await searchParams;

  return <RefreshSession next={safeNextPath(next)} />;
}
