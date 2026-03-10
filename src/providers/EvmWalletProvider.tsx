import { ReactNode, lazy, Suspense } from 'react';

// Lazy load the heavy EVM wallet stack - only needed when user interacts with EVM features
const EvmWalletProviderInner = lazy(() => import('./EvmWalletProviderInner'));

interface EvmWalletProviderProps {
  children: ReactNode;
}

export function EvmWalletProvider({ children }: EvmWalletProviderProps) {
  return (
    <Suspense fallback={<>{children}</>}>
      <EvmWalletProviderInner>{children}</EvmWalletProviderInner>
    </Suspense>
  );
}
