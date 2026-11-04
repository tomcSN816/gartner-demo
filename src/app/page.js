import { redirect } from 'next/navigation';
import { getCurrentReseller } from '@/lib/session';

export default function Home() {
  const reseller = getCurrentReseller();
  if (!reseller) redirect('/login');

  return (
    <>
      <h1>{reseller.name}</h1>
      <p>Welcome. Browse the catalog to start an order.</p>
    </>
  );
}
