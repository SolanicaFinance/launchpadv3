import { create } from 'zustand';

export interface TradeSuccessData {
  type: 'buy' | 'sell';
  ticker: string;
  tokenName?: string;
  mintAddress?: string;
  amount?: string; // e.g. "0.5 SOL" or "100%"
  signature?: string;
  executionMs?: number;
  agentName?: string;
  tokenImageUrl?: string;
  pnlSol?: number;
  pnlPercent?: number;
  /** Chain context for explorer links */
  chain?: 'solana' | 'btc' | 'bnb';
  /** Solana proof signature for BTC trades */
  solanaProofSignature?: string;
  /** Additional explorer URL override */
  explorerUrl?: string;
}

interface TradeSuccessStore {
  isVisible: boolean;
  data: TradeSuccessData | null;
  show: (data: TradeSuccessData) => void;
  hide: () => void;
}

export const useTradeSuccessStore = create<TradeSuccessStore>((set) => ({
  isVisible: false,
  data: null,
  show: (data) => set({ isVisible: true, data }),
  hide: () => set({ isVisible: false, data: null }),
}));

/** Convenience function — call from anywhere without hooks */
export function showTradeSuccess(data: TradeSuccessData) {
  useTradeSuccessStore.getState().show(data);
}
