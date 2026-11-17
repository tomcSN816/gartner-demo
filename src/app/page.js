import Link from 'next/link';
import { redirect } from 'next/navigation';
import HomeDashboard from '@/components/HomeDashboard';
import { getCurrentReseller } from '@/lib/session';

export default function Home() {
  const reseller = getCurrentReseller();
  if (!reseller) redirect('/login');

  return (
    <>
      <section className="hero">
        <div>
          <h1>{reseller.name}</h1>
          <p>{reseller.tagline}</p>
        </div>
        <div className="hero-actions">
          <Link href="/catalog" className="btn primary">Browse catalog</Link>
          <Link href="/guided-selling" className="btn">Start guided selling</Link>
        </div>
      </section>
      <HomeDashboard />
    </>
  );
}
