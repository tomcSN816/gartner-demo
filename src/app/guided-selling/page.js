import { redirect } from 'next/navigation';
import ServiceNowCatalog from '@/components/ServiceNowCatalog';
import { getCurrentReseller } from '@/lib/session';
import { resolveConfiguratorStyle } from '@/lib/resellers';

// Power Generator (FPG): blueprint fpg_bundle.
const POWER_GENERATOR_OFFERING_ID = 'd2f479dc3b0f0310d5260fa693e45ac9';

export default function GuidedSellingPage({ searchParams }) {
  const reseller = getCurrentReseller();
  if (!reseller) redirect('/login');
  const style = resolveConfiguratorStyle(reseller, searchParams);
  // ?product=<product offering sys_id> opens that product instead of the default.
  const urlProduct = /^[a-f0-9]{32}$/.test(searchParams?.product || '') ? searchParams.product : '';
  const productId = urlProduct || POWER_GENERATOR_OFFERING_ID;
  if (urlProduct) style.params.product = urlProduct;
  style.active.product = productId;

  return (
    <>
      <h1>Guided selling</h1>
      <ServiceNowCatalog
        logikLayout={style.layout}
        logikTokens={style.tokens}
        urlParams={style.active}
        guidedProductId={productId}
      />
    </>
  );
}
