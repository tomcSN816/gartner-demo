import { redirect } from 'next/navigation';
import ServiceNowCatalog from '@/components/ServiceNowCatalog';
import { getCurrentReseller } from '@/lib/session';
import { getLogikTokens } from '@/lib/resellers';

export default function CatalogPage() {
  const reseller = getCurrentReseller();
  if (!reseller) redirect('/login');

  return (
    <>
      <h1>Catalog</h1>
      <ServiceNowCatalog
        logikLayout={reseller.logikLayout}
        logikTokens={getLogikTokens(reseller)}
      />
    </>
  );
}
