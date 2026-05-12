/**
 * InModal context — flags whether a page is being rendered inside the
 * Property Modal's Tools tab (vs as a standalone /tools/<slug> route).
 *
 * Consumers:
 *   - PublicLayout         → renders just children (no nav/footer/SEO chrome)
 *   - SEOHead              → no-ops (modal already has the property's
 *                            canonical URL, and Helmet meta tags would
 *                            otherwise stomp on the app shell's tags)
 *   - usePrefill()         → prefers ctx.prefill over URL ?prefill= so we
 *                            don't have to navigate
 *
 * This lets the 13 calculator pages in src/pages/tools/* render in two
 * contexts without per-calculator changes: standalone via React Router,
 * or inline via PropertyToolsTab → InModalProvider wrap.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { PrefillBag } from './property-prefill';

interface InModalCtx {
  inModal: boolean;
  prefill: PrefillBag | null;
}

const InModalContext = createContext<InModalCtx>({ inModal: false, prefill: null });

export function InModalProvider({
  children,
  prefill,
}: {
  children: ReactNode;
  prefill: PrefillBag | null;
}) {
  return (
    <InModalContext.Provider value={{ inModal: true, prefill }}>
      {children}
    </InModalContext.Provider>
  );
}

export function useInModal(): InModalCtx {
  return useContext(InModalContext);
}
