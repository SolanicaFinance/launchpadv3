import { useState, useCallback, useEffect } from 'react';
import { Transaction, VersionedTransaction, PublicKey, Connection, SendOptions } from '@solana/web3.js';
import { useToast } from '@/hooks/use-toast';
import { getRpcUrl } from './useSolanaWallet';

interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: PublicKey;
  isConnected?: boolean;
  signTransaction?: <T extends Transaction | VersionedTransaction>(transaction: T) => Promise<T>;
  signAllTransactions?: <T extends Transaction | VersionedTransaction>(transactions: T[]) => Promise<T[]>;
  signAndSendTransaction?: (
    transaction: Transaction | VersionedTransaction,
    options?: SendOptions
  ) => Promise<{ signature: string }>;
  signMessage?: (message: Uint8Array) => Promise<{ signature: Uint8Array }>;
  connect?: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
  disconnect?: () => Promise<void>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  off?: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    solana?: PhantomProvider;
  }
}

export function usePhantomWallet() {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  const getProvider = useCallback((): PhantomProvider | null => {
    if (typeof window === 'undefined') return null;
    
    // Check for Phantom in window.phantom.solana first (newer standard)
    if (window.phantom?.solana?.isPhantom) {
      return window.phantom.solana;
    }
    
    // Fallback to window.solana
    if (window.solana?.isPhantom) {
      return window.solana;
    }
    
    return null;
  }, []);

  const isPhantomInstalled = useCallback(() => {
    return getProvider() !== null;
  }, [getProvider]);

  const refreshBalance = useCallback(async () => {
    if (!publicKey) return;
    
    setIsLoadingBalance(true);
    try {
      const { url: rpcUrl, source: rpcSource } = getRpcUrl();
      console.log(`[PhantomWallet] Balance fetch using RPC: ${rpcSource}`);
      
      const connection = new Connection(rpcUrl, 'confirmed');
      const balanceLamports = await connection.getBalance(publicKey);
      setBalance(balanceLamports / 1e9); // Convert to SOL
    } catch (error) {
      console.error('[PhantomWallet] Failed to fetch balance:', error);
      setBalance(null);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [publicKey]);

  const connect = useCallback(async () => {
    const provider = getProvider();
    
    if (!provider) {
      toast({
        title: "Phantom not found",
        description: "Please install Phantom wallet extension",
        variant: "destructive",
      });
      window.open('https://phantom.app/', '_blank');
      return null;
    }

    setIsConnecting(true);
    
    try {
      const response = await provider.connect?.();
      if (response?.publicKey) {
        setPublicKey(response.publicKey);
        setIsConnected(true);
        toast({
          title: "Wallet Connected",
          description: `Connected to ${response.publicKey.toBase58().slice(0, 4)}...${response.publicKey.toBase58().slice(-4)}`,
        });
        return response.publicKey;
      }
      return null;
    } catch (error) {
      console.error('[PhantomWallet] Connection error:', error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect wallet",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [getProvider, toast]);

  const disconnect = useCallback(async () => {
    const provider = getProvider();
    
    try {
      await provider?.disconnect?.();
    } catch (error) {
      console.error('[PhantomWallet] Disconnect error:', error);
    } finally {
      setPublicKey(null);
      setIsConnected(false);
      setBalance(null);
    }
  }, [getProvider]);

  const signTransaction = useCallback(async <T extends Transaction | VersionedTransaction>(
    transaction: T
  ): Promise<T | null> => {
    const provider = getProvider();
    
    if (!provider) {
      toast({
        title: "Phantom not connected",
        description: "Please connect your Phantom wallet first",
        variant: "destructive",
      });
      return null;
    }

    try {
      const signedTx = await provider.signTransaction?.(transaction);
      return signedTx ?? null;
    } catch (error) {
      console.error('[PhantomWallet] Sign error:', error);
      toast({
        title: "Signing Failed",
        description: error instanceof Error ? error.message : "Failed to sign transaction",
        variant: "destructive",
      });
      return null;
    }
  }, [getProvider, toast]);

  // Sign multiple transactions at once (single Phantom popup for all)
  const signAllTransactions = useCallback(async <T extends Transaction | VersionedTransaction>(
    transactions: T[]
  ): Promise<T[] | null> => {
    const provider = getProvider();
    
    if (!provider) {
      toast({
        title: "Phantom not connected",
        description: "Please connect your Phantom wallet first",
        variant: "destructive",
      });
      return null;
    }

    if (!provider.signAllTransactions) {
      toast({
        title: "Wallet Error",
        description: "Phantom wallet doesn't support batch signing. Please update Phantom.",
        variant: "destructive",
      });
      return null;
    }

    try {
      console.log(`[PhantomWallet] Requesting batch signature for ${transactions.length} transactions...`);
      const signedTxs = await provider.signAllTransactions(transactions);
      console.log('[PhantomWallet] Batch signature successful');
      return signedTxs;
    } catch (error) {
      console.error('[PhantomWallet] Batch sign error:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('User rejected') || errorMessage.includes('cancelled')) {
        toast({
          title: "Transaction Rejected",
          description: "You rejected the transactions in Phantom",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Batch Signing Failed",
          description: errorMessage.slice(0, 100),
          variant: "destructive",
        });
      }
      
      throw error;
    }
  }, [getProvider, toast]);

  const signAndSendTransaction = useCallback(async (
    transaction: Transaction | VersionedTransaction
  ): Promise<string | null> => {
    const provider = getProvider();
    
    if (!provider) {
      console.error('[PhantomWallet] Provider not found');
      toast({
        title: "Phantom not found",
        description: "Please make sure Phantom wallet is installed and unlocked",
        variant: "destructive",
      });
      return null;
    }

    if (!provider.isConnected) {
      console.error('[PhantomWallet] Provider not connected');
      toast({
        title: "Wallet not connected",
        description: "Please reconnect your Phantom wallet",
        variant: "destructive",
      });
      return null;
    }

    if (!provider.signAndSendTransaction) {
      console.error('[PhantomWallet] signAndSendTransaction method not available');
      toast({
        title: "Wallet Error",
        description: "Phantom wallet doesn't support this operation. Please update Phantom.",
        variant: "destructive",
      });
      return null;
    }

    try {
      console.log('[PhantomWallet] Requesting signature...');
      const result = await provider.signAndSendTransaction(transaction);
      console.log('[PhantomWallet] Signature result:', result);
      return result?.signature ?? null;
    } catch (error) {
      console.error('[PhantomWallet] SignAndSend error:', error);
      
      // Provide more specific error messages
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('User rejected') || errorMessage.includes('cancelled')) {
        toast({
          title: "Transaction Rejected",
          description: "You rejected the transaction in Phantom",
          variant: "destructive",
        });
      } else if (errorMessage.includes('Insufficient')) {
        toast({
          title: "Insufficient SOL",
          description: "Not enough SOL to complete this transaction",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Transaction Failed",
          description: errorMessage.slice(0, 100),
          variant: "destructive",
        });
      }
      
      // Re-throw so the caller knows it failed
      throw error;
    }
  }, [getProvider, toast]);

  // Auto-detect connection status on mount
  useEffect(() => {
    const provider = getProvider();
    if (provider?.isConnected && provider?.publicKey) {
      setPublicKey(provider.publicKey);
      setIsConnected(true);
    }
  }, [getProvider]);

  // Refresh balance when connected
  useEffect(() => {
    if (isConnected && publicKey) {
      refreshBalance();
    }
  }, [isConnected, publicKey, refreshBalance]);

  // Listen for account changes
  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;

    const handleAccountChange = (newPublicKey: PublicKey | null) => {
      if (newPublicKey) {
        setPublicKey(newPublicKey);
        setIsConnected(true);
      } else {
        setPublicKey(null);
        setIsConnected(false);
        setBalance(null);
      }
    };

    const handleDisconnect = () => {
      setPublicKey(null);
      setIsConnected(false);
      setBalance(null);
    };

    provider.on?.('accountChanged', handleAccountChange as (...args: unknown[]) => void);
    provider.on?.('disconnect', handleDisconnect);

    return () => {
      provider.off?.('accountChanged', handleAccountChange as (...args: unknown[]) => void);
      provider.off?.('disconnect', handleDisconnect);
    };
  }, [getProvider]);

  return {
    isPhantomInstalled: isPhantomInstalled(),
    isConnected,
    isConnecting,
    publicKey,
    address: publicKey?.toBase58() ?? null,
    balance,
    isLoadingBalance,
    connect,
    disconnect,
    signTransaction,
    signAllTransactions,
    signAndSendTransaction,
    refreshBalance,
    getProvider,
  };
}
