import ServiceNowCatalog from '@/components/ServiceNowCatalog';

export default function CatalogPage({ searchParams }) {
  return (
    <>
      <h1>Catalog</h1>
      <ServiceNowCatalog
        amendLineId={searchParams?.amendLine}
        amendLabel={searchParams?.label}
      />
    </>
  );
}
