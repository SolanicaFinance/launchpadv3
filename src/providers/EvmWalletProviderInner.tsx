import { ReactNode } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { base, mainnet, bsc, arbitrum } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Configure wagmi with Base, Ethereum mainnet, BSC, and Arbitrum (for Hyperliquid deposits)
const config = createConfig({
  chains: [base, mainnet, bsc, arbitrum],
  transports: {
    [base.id]: http('https://mainnet.base.org'),
    [mainnet.id]: http('https://eth.llamarpc.com'),
    [bsc.id]: http(`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || 'ptwytypavumcrbofspno'}.supabase.co/functions/v1/bsc-rpc`),
    [arbitrum.id]: http('https://arb1.arbitrum.io/rpc'),
  },
});

// Create a separate query client for wagmi to avoid conflicts
const wagmiQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

interface Props {
  children: ReactNode;
}

export default function EvmWalletProviderInner({ children }: Props) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={wagmiQueryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export { config as wagmiConfig };
