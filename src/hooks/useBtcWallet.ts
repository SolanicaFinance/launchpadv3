import { useState, useEffect, useCallback, useMemo } from 'react';

declare global {
  interface Window {
    unisat?: {
      requestAccounts: () => Promise<string[]>;
      getAccounts: () => Promise<string[]>;
      getBalance: () => Promise<{ confirmed: number; unconfirmed: number; total: number }>;
      signPsbt: (psbtHex: string, options?: any) => Promise<string>;
      signMessage: (msg: string) => Promise<string>;
      getNetwork: () => Promise<string>;
      switchNetwork: (network: string) => Promise<void>;
      on: (event: string, handler: (...args: any[]) => void) => void;
      removeListener: (event: string, handler: (...args: any[]) => void) => void;
    };
  }
}

export interface BtcBalance {
  confirmed: number;
  unconfirmed: number;
  total: number;
}

export interface UseBtcWalletReturn {
  address: string | null;
  balance: BtcBalance | null;
  isConnected: boolean;
  isInstalled: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  signPsbt: (psbtHex: string, options?: any) => Promise<string | null>;
  signMessage: (msg: string) => Promise<string | null>;
  refreshBalance: () => Promise<void>;
}

const BTC_WALLET_KEY = 'btc-wallet-connected';

export function useBtcWallet(): UseBtcWalletReturn {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<BtcBalance | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const isInstalled = typeof window !== 'undefined' && !!window.unisat;
  const isConnected = !!address;

  const refreshBalance = useCallback(async () => {
    if (!window.unisat || !address) return;
    try {
      const bal = await window.unisat.getBalance();
      setBalance(bal);
    } catch (e) {
      console.warn('Failed to fetch BTC balance:', e);
    }
  }, [address]);

  const connect = useCallback(async () => {
    if (!window.unisat) {
      window.open('https://unisat.io', '_blank');
      return;
    }
    setIsConnecting(true);
    try {
      const accounts = await window.unisat.requestAccounts();
      if (accounts[0]) {
        setAddress(accounts[0]);
        localStorage.setItem(BTC_WALLET_KEY, 'true');
      }
    } catch (e) {
      console.warn('BTC wallet connect failed:', e);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setBalance(null);
    localStorage.removeItem(BTC_WALLET_KEY);
  }, []);

  const signPsbt = useCallback(async (psbtHex: string, options?: any): Promise<string | null> => {
    if (!window.unisat) return null;
    try {
      return await window.unisat.signPsbt(psbtHex, options);
    } catch (e) {
      console.warn('PSBT signing failed:', e);
      return null;
    }
  }, []);

  const signMessage = useCallback(async (msg: string): Promise<string | null> => {
    if (!window.unisat) return null;
    try {
      return await window.unisat.signMessage(msg);
    } catch (e) {
      console.warn('Message signing failed:', e);
      return null;
    }
  }, []);

  // Auto-reconnect
  useEffect(() => {
    if (!window.unisat || !localStorage.getItem(BTC_WALLET_KEY)) return;
    window.unisat.getAccounts().then((accounts) => {
      if (accounts[0]) setAddress(accounts[0]);
    }).catch(() => {});
  }, []);

  // Refresh balance when address changes
  useEffect(() => {
    if (address) refreshBalance();
  }, [address, refreshBalance]);

  // Listen for account changes
  useEffect(() => {
    if (!window.unisat) return;
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts[0]) {
        setAddress(accounts[0]);
      } else {
        disconnect();
      }
    };
    window.unisat.on('accountsChanged', handleAccountsChanged);
    return () => {
      window.unisat?.removeListener('accountsChanged', handleAccountsChanged);
    };
  }, [disconnect]);

  return useMemo(() => ({
    address,
    balance,
    isConnected,
    isInstalled,
    isConnecting,
    connect,
    disconnect,
    signPsbt,
    signMessage,
    refreshBalance,
  }), [address, balance, isConnected, isInstalled, isConnecting, connect, disconnect, signPsbt, signMessage, refreshBalance]);
}
