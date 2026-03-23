import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Multi-wallet BTC hook supporting UniSat, Xverse, Leather, OKX, and Phantom.
 * Uses direct window injections plus WBIP004-style provider registries when available.
 */

export type BtcWalletProvider = 'unisat' | 'xverse' | 'leather' | 'okx' | 'phantom' | 'unknown';

type ProviderRequest = ((method: string, params?: any) => Promise<any>) | ((args: { method: string; params?: any }) => Promise<any>);

interface GenericBitcoinProvider {
  request?: ProviderRequest;
  requestAccounts?: () => Promise<any>;
  getAccounts?: () => Promise<any>;
  getBalance?: () => Promise<{ confirmed: number; unconfirmed: number; total: number }>;
  signPsbt?: (psbtHex: string, options?: any) => Promise<string>;
  signPSBT?: (psbt: Uint8Array, options?: any) => Promise<{ psbt: Uint8Array }>;
  signMessage?: (...args: any[]) => Promise<any>;
  getNetwork?: () => Promise<string>;
  switchNetwork?: (network: string) => Promise<void>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
  [key: string]: any;
}

interface InjectedProviderDescriptor {
  id?: string;
  name?: string;
  providerId?: string;
  displayName?: string;
  provider?: GenericBitcoinProvider;
  wallet?: GenericBitcoinProvider;
  [key: string]: any;
}

declare global {
  interface Window {
    unisat?: GenericBitcoinProvider;
    XverseProviders?: {
      BitcoinProvider?: GenericBitcoinProvider;
    };
    btc?: GenericBitcoinProvider;
    btc_providers?: InjectedProviderDescriptor[];
    webbtc_providers?: InjectedProviderDescriptor[];
    LeatherProvider?: GenericBitcoinProvider;
    okxwallet?: {
      bitcoin?: GenericBitcoinProvider;
    };
    phantom?: {
      solana?: {
        isPhantom?: boolean;
      };
      bitcoin?: GenericBitcoinProvider;
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

const WALLET_META: Array<Pick<BtcWalletInfo, 'id' | 'name' | 'icon' | 'downloadUrl'>> = [
  { id: 'unisat', name: 'UniSat', icon: 'U', downloadUrl: 'https://unisat.io' },
  { id: 'xverse', name: 'Xverse', icon: 'X', downloadUrl: 'https://www.xverse.app' },
  { id: 'leather', name: 'Leather', icon: 'L', downloadUrl: 'https://leather.io' },
  { id: 'okx', name: 'OKX Wallet', icon: 'OKX', downloadUrl: 'https://www.okx.com/web3' },
  { id: 'phantom', name: 'Phantom', icon: 'P', downloadUrl: 'https://phantom.app' },
];

function getRegistryProviders(): InjectedProviderDescriptor[] {
  if (typeof window === 'undefined') return [];
  const fromRegistry = Array.isArray(window.btc_providers) ? window.btc_providers : [];
  const fromLegacyRegistry = Array.isArray(window.webbtc_providers) ? window.webbtc_providers : [];
  return [...fromRegistry, ...fromLegacyRegistry].filter(Boolean);
}

function providerMatches(entry: InjectedProviderDescriptor, searchTerms: string[]) {
  const haystack = [entry?.id, entry?.name, entry?.providerId, entry?.displayName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return searchTerms.some(term => haystack.includes(term));
}

function unwrapProvider(entry: InjectedProviderDescriptor | GenericBitcoinProvider | null | undefined): GenericBitcoinProvider | null {
  if (!entry) return null;
  if ('provider' in entry && entry.provider) return entry.provider;
  if ('wallet' in entry && entry.wallet) return entry.wallet;
  return entry as GenericBitcoinProvider;
}

function getInjectedProvider(walletId: BtcWalletProvider): GenericBitcoinProvider | null {
  if (typeof window === 'undefined') return null;

  if (walletId === 'unisat' && window.unisat) return window.unisat;
  if (walletId === 'xverse' && window.XverseProviders?.BitcoinProvider) return window.XverseProviders.BitcoinProvider;
  if (walletId === 'xverse' && window.btc) return window.btc;
  if (walletId === 'leather' && window.LeatherProvider) return window.LeatherProvider;
  if (walletId === 'okx' && window.okxwallet?.bitcoin) return window.okxwallet.bitcoin;
  if (walletId === 'phantom' && window.phantom?.bitcoin) return window.phantom.bitcoin;

  const registryProviders = getRegistryProviders();
  const searchTerms: Record<BtcWalletProvider, string[]> = {
    unisat: ['unisat'],
    xverse: ['xverse', 'bitcoinprovider'],
    leather: ['leather'],
    okx: ['okx'],
    phantom: ['phantom'],
    unknown: ['bitcoin'],
  };

  const entry = registryProviders.find(provider => providerMatches(provider, searchTerms[walletId]));
  return unwrapProvider(entry);
}

async function requestProviderMethod(provider: GenericBitcoinProvider, method: string, params?: any) {
  if (typeof provider.request !== 'function') return null;

  try {
    return await (provider.request as (method: string, params?: any) => Promise<any>)(method, params);
  } catch {
    return await (provider.request as (args: { method: string; params?: any }) => Promise<any>)({ method, params });
  }
}

function extractAddress(payload: any): string | null {
  if (!payload) return null;
  if (typeof payload === 'string') return payload;
  if (Array.isArray(payload)) return extractAddress(payload[0]);
  if (typeof payload === 'object') {
    if (typeof payload.address === 'string') return payload.address;
    if (payload.result) return extractAddress(payload.result);
    if (payload.addresses) return extractAddress(payload.addresses);
    if (payload.accounts) return extractAddress(payload.accounts);
    if (payload.paymentAddress?.address) return payload.paymentAddress.address;
  }
  return null;
}

async function getExistingAddress(walletId: BtcWalletProvider): Promise<string | null> {
  const provider = getInjectedProvider(walletId);
  if (!provider) return null;

  if (typeof provider.getAccounts === 'function') {
    return extractAddress(await provider.getAccounts());
  }

  if (walletId === 'leather') {
    const response = await requestProviderMethod(provider, 'getAddresses');
    return extractAddress(response);
  }

  const response = await requestProviderMethod(provider, 'getAccounts', {
    purposes: ['payment'],
    message: 'Reconnect to Saturn Terminal',
  });

  return extractAddress(response);
}

function detectWallets(): BtcWalletInfo[] {
  return WALLET_META.map(wallet => ({
    ...wallet,
    installed: !!getInjectedProvider(wallet.id),
  }));
}

async function connectUniSat(): Promise<string | null> {
  const provider = getInjectedProvider('unisat');
  if (!provider) return null;

  if (typeof provider.requestAccounts === 'function') {
    return extractAddress(await provider.requestAccounts());
  }

  return extractAddress(await requestProviderMethod(provider, 'getAccounts', {
    purposes: ['payment'],
    message: 'Connect to Saturn Terminal',
  }));
}

async function connectXverse(): Promise<string | null> {
  const provider = getInjectedProvider('xverse');
  if (!provider) return null;

  const response = await requestProviderMethod(provider, 'getAccounts', {
    purposes: ['payment'],
    message: 'Connect to Saturn Terminal',
  });

  return extractAddress(response);
}

async function connectLeather(): Promise<string | null> {
  const provider = getInjectedProvider('leather');
  if (!provider) return null;

  const response = await requestProviderMethod(provider, 'getAddresses');
  const address = extractAddress(response);
  if (address) return address;

  return extractAddress(await requestProviderMethod(provider, 'getAccounts', {
    purposes: ['payment'],
    message: 'Connect to Saturn Terminal',
  }));
}

async function connectOKX(): Promise<string | null> {
  const provider = getInjectedProvider('okx');
  if (!provider) return null;

  if (typeof provider.requestAccounts === 'function') {
    return extractAddress(await provider.requestAccounts());
  }

  return extractAddress(await requestProviderMethod(provider, 'getAccounts', {
    purposes: ['payment'],
    message: 'Connect to Saturn Terminal',
  }));
}

async function connectPhantom(): Promise<string | null> {
  const provider = getInjectedProvider('phantom');
  if (!provider) return null;

  if (typeof provider.requestAccounts === 'function') {
    return extractAddress(await provider.requestAccounts());
  }

  return extractAddress(await requestProviderMethod(provider, 'requestAccounts'));
}

async function getBalance(provider: BtcWalletProvider): Promise<BtcBalance | null> {
  try {
    const wallet = getInjectedProvider(provider);
    if (!wallet || typeof wallet.getBalance !== 'function') return null;
    return await wallet.getBalance();
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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let mounted = true;
    const detect = () => {
      if (!mounted) return;
      setAvailableWallets(detectWallets());
    };

    detect();

    const timers = [250, 600, 1200, 2000, 3500, 5000, 8000].map(ms => setTimeout(detect, ms));
    const interval = setInterval(detect, 700);
    const stopPolling = setTimeout(() => clearInterval(interval), 12000);
    const onFocus = () => detect();
    const onVisibility = () => {
      if (!document.hidden) detect();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mounted = false;
      timers.forEach(clearTimeout);
      clearInterval(interval);
      clearTimeout(stopPolling);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
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
        const wallets = detectWallets();
        const installed = wallets.find(w => w.installed);
        if (!installed) {
          window.open('https://unisat.io', '_blank');
          return;
        }
        usedProvider = installed.id;
      }

      switch (usedProvider) {
        case 'unisat':
          addr = await connectUniSat();
          break;
        case 'xverse':
          addr = await connectXverse();
          break;
        case 'leather':
          addr = await connectLeather();
          break;
        case 'okx':
          addr = await connectOKX();
          break;
        case 'phantom':
          addr = await connectPhantom();
          break;
        default:
          break;
      }

      if (addr) {
        setAddress(addr);
        setActiveProvider(usedProvider);
        localStorage.setItem(BTC_WALLET_KEY, 'true');
        localStorage.setItem(BTC_PROVIDER_KEY, usedProvider);
        return;
      }

      throw new Error(`Unable to connect to ${usedProvider}. Make sure the wallet extension is unlocked.`);
    } catch (e) {
      console.warn('BTC wallet connect failed:', e);
      throw e;
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
      if (!activeProvider) return null;
      const provider = getInjectedProvider(activeProvider);
      if (!provider) return null;

      if (typeof provider.signPsbt === 'function') {
        return await provider.signPsbt(psbtHex, options);
      }

      if (typeof provider.signPSBT === 'function') {
        const hexBytes = Uint8Array.from(psbtHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
        const signed = await provider.signPSBT(hexBytes, options);
        if (signed?.psbt instanceof Uint8Array) {
          return Array.from(signed.psbt).map(byte => byte.toString(16).padStart(2, '0')).join('');
        }
      }

      console.warn(`PSBT signing not implemented for ${activeProvider}`);
      return null;
    } catch (e) {
      console.warn('PSBT signing failed:', e);
      return null;
    }
  }, [activeProvider]);

  const signMessage = useCallback(async (msg: string): Promise<string | null> => {
    try {
      if (!activeProvider) return null;
      const provider = getInjectedProvider(activeProvider);
      if (!provider || typeof provider.signMessage !== 'function') return null;

      if (activeProvider === 'phantom' && address) {
        const encoded = new TextEncoder().encode(msg);
        const result = await provider.signMessage(address, encoded);
        return result?.signature || null;
      }

      const result = await provider.signMessage(msg);
      return typeof result === 'string' ? result : result?.signature || null;
    } catch (e) {
      console.warn('Message signing failed:', e);
      return null;
    }
  }, [activeProvider, address]);

  useEffect(() => {
    if (!localStorage.getItem(BTC_WALLET_KEY)) return;
    const savedProvider = localStorage.getItem(BTC_PROVIDER_KEY) as BtcWalletProvider | null;
    if (!savedProvider) return;

    const tryReconnect = async () => {
      try {
        const addr = await getExistingAddress(savedProvider);
        if (addr) {
          setAddress(addr);
          setActiveProvider(savedProvider);
        }
      } catch {
        // Silent reconnect failure; user can reconnect manually.
      }
    };

    const timer = setTimeout(tryReconnect, 900);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (address) refreshBalance();
  }, [address, refreshBalance]);

  useEffect(() => {
    const handler = (accounts: any) => {
      const nextAddress = extractAddress(accounts);
      if (nextAddress) setAddress(nextAddress);
      else disconnect();
    };

    const provider = activeProvider ? getInjectedProvider(activeProvider) : null;
    if (!provider || typeof provider.on !== 'function' || typeof provider.removeListener !== 'function') return;

    provider.on('accountsChanged', handler);
    return () => {
      provider.removeListener?.('accountsChanged', handler);
    };
  }, [activeProvider, disconnect]);

  return useMemo(() => ({
    address,
    balance,
    isConnected,
    isConnecting,
    activeProvider,
    availableWallets,
    connect,
    disconnect,
    signPsbt,
    signMessage,
    refreshBalance,
  }), [address, balance, isConnected, isConnecting, activeProvider, availableWallets, connect, disconnect, signPsbt, signMessage, refreshBalance]);
}
