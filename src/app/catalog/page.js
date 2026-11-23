import { redirect } from 'next/navigation';
import ServiceNowCatalog from '@/components/ServiceNowCatalog';
import { getCurrentReseller } from '@/lib/session';
import { resolveConfiguratorStyle } from '@/lib/resellers';

export default function CatalogPage({ searchParams }) {
  const reseller = getCurrentReseller();
  if (!reseller) redirect('/login');
  const style = resolveConfiguratorStyle(reseller, searchParams);

  return (
    <>
      <h1>Catalog</h1>
      <ServiceNowCatalog
        logikLayout={style.layout}
        logikTokens={style.tokens}
        urlParams={style.active}
        amendLineId={searchParams?.amendLine}
        amendLabel={searchParams?.label}
        quoteLineId={searchParams?.quoteLine}
      />
    </>
  );
}
