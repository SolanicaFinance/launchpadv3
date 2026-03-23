import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Multi-wallet BTC hook supporting UniSat, Xverse, Leather, OKX, and others.
 * Each wallet provider injects a global object (window.unisat, window.XverseProviders, etc.)
 */

export type BtcWalletProvider = 'unisat' | 'xverse' | 'leather' | 'okx' | 'phantom' | 'unknown';

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
    XverseProviders?: {
      BitcoinProvider?: {
        request: (method: string, params?: any) => Promise<any>;
      };
    };
    btc?: {
      request: (method: string, params?: any) => Promise<any>;
    };
    LeatherProvider?: {
      request: (method: string, params?: any) => Promise<any>;
    };
    okxwallet?: {
      bitcoin?: {
        requestAccounts: () => Promise<string[]>;
        getAccounts: () => Promise<string[]>;
        getBalance: () => Promise<{ confirmed: number; unconfirmed: number; total: number }>;
        signPsbt: (psbtHex: string, options?: any) => Promise<string>;
        signMessage: (msg: string) => Promise<string>;
        on: (event: string, handler: (...args: any[]) => void) => void;
        removeListener: (event: string, handler: (...args: any[]) => void) => void;
      };
    };
    phantom?: {
      bitcoin?: {
        requestAccounts: () => Promise<{ address: string; addressType: string; publicKey: string }[]>;
        signMessage: (address: string, message: Uint8Array) => Promise<{ signature: string }>;
        signPSBT: (psbt: Uint8Array, options?: any) => Promise<{ psbt: Uint8Array }>;
      };
    };
  }
}

export interface BtcWalletInfo {
  id: BtcWalletProvider;
  name: string;
  icon: string;
  installed: boolean;
  downloadUrl: string;
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
  isConnecting: boolean;
  activeProvider: BtcWalletProvider | null;
  availableWallets: BtcWalletInfo[];
  connect: (provider?: BtcWalletProvider) => Promise<void>;
  disconnect: () => void;
  signPsbt: (psbtHex: string, options?: any) => Promise<string | null>;
  signMessage: (msg: string) => Promise<string | null>;
  refreshBalance: () => Promise<void>;
}

const BTC_WALLET_KEY = 'btc-wallet-connected';
const BTC_PROVIDER_KEY = 'btc-wallet-provider';

function detectWallets(): BtcWalletInfo[] {
  if (typeof window === 'undefined') return [];
  
  return [
    {
      id: 'unisat' as const,
      name: 'UniSat',
      icon: '🟧',
      installed: !!window.unisat,
      downloadUrl: 'https://unisat.io',
    },
    {
      id: 'xverse' as const,
      name: 'Xverse',
      icon: '🟪',
      installed: !!(window.XverseProviders?.BitcoinProvider || window.btc),
      downloadUrl: 'https://www.xverse.app',
    },
    {
      id: 'leather' as const,
      name: 'Leather',
      icon: '🟫',
      installed: !!window.LeatherProvider,
      downloadUrl: 'https://leather.io',
    },
    {
      id: 'okx' as const,
      name: 'OKX Wallet',
      icon: '⬛',
      installed: !!window.okxwallet?.bitcoin,
      downloadUrl: 'https://www.okx.com/web3',
    },
    {
      id: 'phantom' as const,
      name: 'Phantom',
      icon: '👻',
      installed: !!window.phantom?.bitcoin,
      downloadUrl: 'https://phantom.app',
    },
  ];
}

async function connectUniSat(): Promise<string | null> {
  if (!window.unisat) return null;
  const accounts = await window.unisat.requestAccounts();
  return accounts[0] || null;
}

async function connectXverse(): Promise<string | null> {
  const provider = window.XverseProviders?.BitcoinProvider || window.btc;
  if (!provider) return null;
  const res = await provider.request('getAccounts', {
    purposes: ['payment'],
    message: 'Connect to Saturn Terminal',
  });
  const accounts = res?.result || res;
  if (Array.isArray(accounts) && accounts.length > 0) {
    return accounts[0].address || accounts[0];
  }
  return null;
}

async function connectLeather(): Promise<string | null> {
  if (!window.LeatherProvider) return null;
  const res = await window.LeatherProvider.request('getAddresses');
  const addresses = res?.result?.addresses;
  if (Array.isArray(addresses)) {
    // Prefer native segwit (p2wpkh)
    const native = addresses.find((a: any) => a.type === 'p2wpkh');
    return native?.address || addresses[0]?.address || null;
  }
  return null;
}

async function connectOKX(): Promise<string | null> {
  if (!window.okxwallet?.bitcoin) return null;
  const accounts = await window.okxwallet.bitcoin.requestAccounts();
  return accounts[0] || null;
}

async function connectPhantom(): Promise<string | null> {
  if (!window.phantom?.bitcoin) return null;
  const accounts = await window.phantom.bitcoin.requestAccounts();
  if (accounts.length > 0) {
    return accounts[0].address;
  }
  return null;
}

async function getBalance(provider: BtcWalletProvider): Promise<BtcBalance | null> {
  try {
    if (provider === 'unisat' && window.unisat) {
      return await window.unisat.getBalance();
    }
    if (provider === 'okx' && window.okxwallet?.bitcoin) {
      return await window.okxwallet.bitcoin.getBalance();
    }
    // For wallets without direct balance API, return null (UI will handle)
    return null;
  } catch {
    return null;
  }
}

export function useBtcWallet(): UseBtcWalletReturn {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<BtcBalance | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeProvider, setActiveProvider] = useState<BtcWalletProvider | null>(null);
  const [availableWallets, setAvailableWallets] = useState<BtcWalletInfo[]>([]);

  const isConnected = !!address;

  // Detect wallets on mount and re-detect aggressively for slow extensions
  useEffect(() => {
    const detect = () => setAvailableWallets(detectWallets());
    detect();
    const timers = [300, 800, 1500, 3000, 5000].map(ms => setTimeout(detect, ms));
    // Also listen for unisat injection
    const interval = setInterval(() => {
      if (window.unisat) {
        detect();
        clearInterval(interval);
      }
    }, 500);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(interval);
    };
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!activeProvider || !address) return;
    const bal = await getBalance(activeProvider);
    if (bal) setBalance(bal);
  }, [activeProvider, address]);

  const connect = useCallback(async (provider?: BtcWalletProvider) => {
    setIsConnecting(true);
    try {
      let addr: string | null = null;
      let usedProvider: BtcWalletProvider = provider || 'unisat';

      if (!provider) {
        // Auto-detect first available wallet
        const wallets = detectWallets();
        const installed = wallets.find(w => w.installed);
        if (!installed) {
          // No wallets installed — open a generic download page
          window.open('https://unisat.io', '_blank');
          return;
        }
        usedProvider = installed.id;
      }

      switch (usedProvider) {
        case 'unisat': addr = await connectUniSat(); break;
        case 'xverse': addr = await connectXverse(); break;
        case 'leather': addr = await connectLeather(); break;
        case 'okx': addr = await connectOKX(); break;
        case 'phantom': addr = await connectPhantom(); break;
      }

      if (addr) {
        setAddress(addr);
        setActiveProvider(usedProvider);
        localStorage.setItem(BTC_WALLET_KEY, 'true');
        localStorage.setItem(BTC_PROVIDER_KEY, usedProvider);
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
    setActiveProvider(null);
    localStorage.removeItem(BTC_WALLET_KEY);
    localStorage.removeItem(BTC_PROVIDER_KEY);
  }, []);

  const signPsbt = useCallback(async (psbtHex: string, options?: any): Promise<string | null> => {
    try {
      if (activeProvider === 'unisat' && window.unisat) {
        return await window.unisat.signPsbt(psbtHex, options);
      }
      if (activeProvider === 'okx' && window.okxwallet?.bitcoin) {
        return await window.okxwallet.bitcoin.signPsbt(psbtHex, options);
      }
      // Other providers have different PSBT signing APIs
      console.warn(`PSBT signing not implemented for ${activeProvider}`);
      return null;
    } catch (e) {
      console.warn('PSBT signing failed:', e);
      return null;
    }
  }, [activeProvider]);

  const signMessage = useCallback(async (msg: string): Promise<string | null> => {
    try {
      if (activeProvider === 'unisat' && window.unisat) {
        return await window.unisat.signMessage(msg);
      }
      if (activeProvider === 'okx' && window.okxwallet?.bitcoin) {
        return await window.okxwallet.bitcoin.signMessage(msg);
      }
      console.warn(`Message signing not implemented for ${activeProvider}`);
      return null;
    } catch (e) {
      console.warn('Message signing failed:', e);
      return null;
    }
  }, [activeProvider]);

  // Auto-reconnect from saved provider
  useEffect(() => {
    if (!localStorage.getItem(BTC_WALLET_KEY)) return;
    const savedProvider = localStorage.getItem(BTC_PROVIDER_KEY) as BtcWalletProvider | null;
    if (!savedProvider) return;

    const tryReconnect = async () => {
      try {
        let addr: string | null = null;
        switch (savedProvider) {
          case 'unisat':
            if (window.unisat) {
              const accounts = await window.unisat.getAccounts();
              addr = accounts[0] || null;
            }
            break;
          case 'okx':
            if (window.okxwallet?.bitcoin) {
              const accounts = await window.okxwallet.bitcoin.getAccounts();
              addr = accounts[0] || null;
            }
            break;
          // Other providers may not support passive reconnect
          default:
            break;
        }
        if (addr) {
          setAddress(addr);
          setActiveProvider(savedProvider);
        }
      } catch {}
    };

    // Delay to let extensions inject
    const timer = setTimeout(tryReconnect, 500);
    return () => clearTimeout(timer);
  }, []);

  // Refresh balance on address change
  useEffect(() => {
    if (address) refreshBalance();
  }, [address, refreshBalance]);

  // Listen for account changes (UniSat / OKX)
  useEffect(() => {
    const handler = (accounts: string[]) => {
      if (accounts[0]) setAddress(accounts[0]);
      else disconnect();
    };
    if (activeProvider === 'unisat' && window.unisat) {
      window.unisat.on('accountsChanged', handler);
      return () => { window.unisat?.removeListener('accountsChanged', handler); };
    }
    if (activeProvider === 'okx' && window.okxwallet?.bitcoin) {
      window.okxwallet.bitcoin.on('accountsChanged', handler);
      return () => { window.okxwallet?.bitcoin?.removeListener('accountsChanged', handler); };
    }
  }, [activeProvider, disconnect]);

  return useMemo(() => ({
    address, balance, isConnected, isConnecting,
    activeProvider, availableWallets,
    connect, disconnect, signPsbt, signMessage, refreshBalance,
  }), [address, balance, isConnected, isConnecting, activeProvider, availableWallets, connect, disconnect, signPsbt, signMessage, refreshBalance]);
}
