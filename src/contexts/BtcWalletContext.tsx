import React, { createContext, useContext, ReactNode } from 'react';
import { useBtcWalletInternal, UseBtcWalletReturn } from '@/hooks/useBtcWallet';

const BtcWalletContext = createContext<UseBtcWalletReturn | null>(null);

export function BtcWalletProvider({ children }: { children: ReactNode }) {
  const wallet = useBtcWalletInternal();
  return (
    <BtcWalletContext.Provider value={wallet}>
      {children}
    </BtcWalletContext.Provider>
  );
}

export function useBtcWalletContext(): UseBtcWalletReturn {
  const context = useContext(BtcWalletContext);
  if (!context) {
    throw new Error('useBtcWalletContext must be used within a BtcWalletProvider');
  }
  return context;
}
