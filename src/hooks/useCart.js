'use client';

import { useCallback, useEffect, useState } from 'react';
import { getCurrentCart, getCartLines } from '@/lib/servicenow';
import { CART_CHANGED } from '@/lib/cartEvents';

export default function useCart() {
  const [state, setState] = useState({ cart: null, lines: [], loading: true, error: '' });

  const reload = useCallback(async () => {
    try {
      const cart = await getCurrentCart();
      const lines = cart ? await getCartLines(cart.sys_id) : [];
      setState({ cart, lines, loading: false, error: '' });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: String(e.message ?? e) }));
    }
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(CART_CHANGED, reload);
    return () => window.removeEventListener(CART_CHANGED, reload);
  }, [reload]);

  return { ...state, reload };
}
