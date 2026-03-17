import { ReactNode, Suspense } from 'react';
import { lazyWithRetry } from '@/utils/lazyWithRetry';

// Lazy load the heavy EVM wallet stack with retry to handle transient fetch failures
const EvmWalletProviderInner = lazyWithRetry(() => import('./EvmWalletProviderInner'));

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
