import { ReactNode } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { base, mainnet, bsc } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, getDefaultConfig, darkTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';

// Configure wagmi with Base and Ethereum mainnet
const config = getDefaultConfig({
  appName: 'MoonDexo',
  projectId: 'claw-launchpad-base', // WalletConnect project ID (can be updated)
  chains: [base, mainnet, bsc],
  transports: {
    [base.id]: http('https://mainnet.base.org'),
    [mainnet.id]: http('https://eth.llamarpc.com'),
    [bsc.id]: http(`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || 'ptwytypavumcrbofspno'}.supabase.co/functions/v1/bsc-rpc`),
  },
  ssr: false,
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
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: 'hsl(var(--primary))',
            accentColorForeground: 'hsl(var(--primary-foreground))',
            borderRadius: 'medium',
            fontStack: 'system',
          })}
          modalSize="compact"
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export { config as wagmiConfig };
