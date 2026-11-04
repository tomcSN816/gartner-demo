import { NextResponse } from 'next/server';

// Same-origin proxy to the ServiceNow instance so the Product Catalog web
// component (and the UXF framework it loads) can run on this origin.
// Credentials stay server-side; the browser never sees them.
export const config = {
  matcher: [
    '/sn_b2b_portal.embedabbles.jsdbx',
    '/uxgp/:path*',
    '/uxasset/:path*',
    '/uxpf/:path*',
    '/uxta/:path*',
    '/scripts/:path*',
    '/images/:path*',
    '/amb/:path*',
    '/:hash([a-f0-9]{32}\\.iix)',
    '/api/now/:path*',
    '/api/sn_:path*',
    '/xmlhttp.do',
    '/angular.do',
  ],
};

export function middleware(request) {
  if (request.method !== 'GET') console.log('[sn-proxy]', request.method, request.nextUrl.pathname);
  const instance = process.env.SN_INSTANCE;
  if (!instance) {
    return new NextResponse('SN_INSTANCE is not configured', { status: 500 });
  }

  const target = new URL(request.nextUrl.pathname + request.nextUrl.search, instance);
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('cookie');

  const { SN_USERNAME, SN_PASSWORD } = process.env;
  if (SN_USERNAME && SN_PASSWORD) {
    const token = Buffer.from(`${SN_USERNAME}:${SN_PASSWORD}`).toString('base64');
    headers.set('authorization', `Basic ${token}`);
  }

  return NextResponse.rewrite(target, { request: { headers } });
}
