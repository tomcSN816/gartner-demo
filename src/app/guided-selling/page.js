import { redirect } from 'next/navigation';
import ServiceNowCatalog from '@/components/ServiceNowCatalog';
import { getCurrentReseller } from '@/lib/session';
import { getLogikTokens } from '@/lib/resellers';

// Power Generator (FPG): blueprint fpg_bundle.
const POWER_GENERATOR_OFFERING_ID = 'd2f479dc3b0f0310d5260fa693e45ac9';

export default function GuidedSellingPage() {
  const reseller = getCurrentReseller();
  if (!reseller) redirect('/login');

  return (
    <>
      <h1>Guided selling</h1>
      <ServiceNowCatalog
        logikLayout={reseller.logikLayout}
        logikTokens={getLogikTokens(reseller)}
        guidedProductId={POWER_GENERATOR_OFFERING_ID}
      />
    </>
  );
}
