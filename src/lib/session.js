import { cookies } from 'next/headers';
import { getReseller, RESELLER_COOKIE } from '@/lib/resellers';

// Server-side: the reseller chosen on the fake login screen, or null.
export function getCurrentReseller() {
  return getReseller(cookies().get(RESELLER_COOKIE)?.value);
}
