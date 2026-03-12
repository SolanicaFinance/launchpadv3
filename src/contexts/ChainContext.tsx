import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type SupportedChain = 'solana' | 'base' | 'ethereum' | 'bnb';

export interface ChainConfig {
  id: SupportedChain;
  name: string;
  shortName: string;
  icon: string;
  nativeCurrency: { symbol: string; decimals: number };
  explorerUrl: string;
  chainId?: number; // EVM chain ID
  isEnabled: boolean;
  rpcUrl?: string;
}

export const CHAIN_CONFIGS: Record<SupportedChain, ChainConfig> = {
  solana: {
    id: 'solana',
    name: 'Solana',
    shortName: 'SOL',
    icon: '◎',
    nativeCurrency: { symbol: 'SOL', decimals: 9 },
    explorerUrl: 'https://solscan.io',
    isEnabled: true,
  },
  base: {
    id: 'base',
    name: 'Base',
    shortName: 'BASE',
    icon: '🔵',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    explorerUrl: 'https://basescan.org',
    chainId: 8453,
    isEnabled: false, // Coming soon
    rpcUrl: 'https://mainnet.base.org',
  },
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    shortName: 'ETH',
    icon: '⟠',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    explorerUrl: 'https://etherscan.io',
    chainId: 1,
    isEnabled: false, // Coming soon
  },
  bnb: {
    id: 'bnb',
    name: 'BNB Chain',
    shortName: 'BNB',
    icon: '🟡',
    nativeCurrency: { symbol: 'BNB', decimals: 18 },
    explorerUrl: 'https://bscscan.com',
    chainId: 56,
    isEnabled: true,
    rpcUrl: `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || 'ptwytypavumcrbofspno'}.supabase.co/functions/v1/bsc-rpc`,
  },
};

interface ChainContextValue {
  chain: SupportedChain;
  setChain: (chain: SupportedChain) => void;
  chainConfig: ChainConfig;
  allChains: ChainConfig[];
  isEvmChain: boolean;
}

const ChainContext = createContext<ChainContextValue | undefined>(undefined);

const STORAGE_KEY = 'claw-selected-chain';

interface ChainProviderProps {
  children: ReactNode;
}

export function ChainProvider({ children }: ChainProviderProps) {
  const [chain, setChainState] = useState<SupportedChain>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored in CHAIN_CONFIGS) {
        return stored as SupportedChain;
      }
    }
    return 'bnb';
  });

  const setChain = (newChain: SupportedChain) => {
    setChainState(newChain);
    localStorage.setItem(STORAGE_KEY, newChain);
  };

  const chainConfig = CHAIN_CONFIGS[chain];
  const allChains = Object.values(CHAIN_CONFIGS);
  const isEvmChain = chain !== 'solana';

  return (
    <ChainContext.Provider value={{ chain, setChain, chainConfig, allChains, isEvmChain }}>
      {children}
    </ChainContext.Provider>
  );
}

export function useChain() {
  const context = useContext(ChainContext);
  if (!context) {
    throw new Error('useChain must be used within a ChainProvider');
  }
  return context;
}
