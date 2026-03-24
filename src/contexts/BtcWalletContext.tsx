import React, { createContext, useContext, ReactNode } from 'react';
import type { UseBtcWalletReturn } from '@/hooks/useBtcWallet';

// We import the internal hook dynamically to avoid circular deps
// The internal function is exported as useBtcWalletInternal from the hook file
import { useBtcWalletInternal } from '@/hooks/useBtcWallet';

const BtcWalletContext = createContext<UseBtcWalletReturn | null>(null);

export function BtcWalletProvider({ children }: { children: ReactNode }) {
  const wallet = useBtcWalletInternal();
  return (
    <BtcWalletContext.Provider value={wallet}>
      {children}
    </BtcWalletContext.Provider>
  );
}

export function useBtcWallet(): UseBtcWalletReturn {
  const context = useContext(BtcWalletContext);
  if (!context) {
    throw new Error('useBtcWallet must be used within a BtcWalletProvider');
  }
  return context;
}
