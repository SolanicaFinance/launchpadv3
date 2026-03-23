import { useNavigate, useLocation } from 'react-router-dom';
import { useChain, SupportedChain, CHAIN_CONFIGS } from '@/contexts/ChainContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import solanaLogo from '@/assets/solana-logo.png';
import bitcoinLogo from '@/assets/bitcoin-logo.png';

// Chain logo components
function SolanaLogo({ className }: { className?: string }) {
  return (
    <img src={solanaLogo} alt="Solana" className={cn("rounded-full", className)} />
  );
}

function BaseLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#0052FF" />
      <path
        d="M16 26C21.5228 26 26 21.5228 26 16C26 10.4772 21.5228 6 16 6C10.4772 6 6 10.4772 6 16C6 21.5228 10.4772 26 16 26Z"
        fill="#0052FF"
      />
      <path
        d="M16 24C20.4183 24 24 20.4183 24 16C24 11.5817 20.4183 8 16 8C11.5817 8 8 11.5817 8 16C8 20.4183 11.5817 24 16 24Z"
        fill="white"
      />
      <path
        d="M16 22C19.3137 22 22 19.3137 22 16C22 12.6863 19.3137 10 16 10V22Z"
        fill="#0052FF"
      />
    </svg>
  );
}

function EthereumLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#627EEA" />
      <path d="M16 4L16 12.8L23 16.2L16 4Z" fill="white" fillOpacity="0.6" />
      <path d="M16 4L9 16.2L16 12.8L16 4Z" fill="white" />
      <path d="M16 21.9L16 28L23 17.6L16 21.9Z" fill="white" fillOpacity="0.6" />
      <path d="M16 28L16 21.9L9 17.6L16 28Z" fill="white" />
      <path d="M16 20.5L23 16.2L16 12.8L16 20.5Z" fill="white" fillOpacity="0.2" />
      <path d="M9 16.2L16 20.5L16 12.8L9 16.2Z" fill="white" fillOpacity="0.6" />
    </svg>
  );
}

function BnbLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#F3BA2F" />
      <path
        d="M16 8L18.5 10.5L13.5 15.5L11 13L16 8Z"
        fill="white"
      />
      <path
        d="M20.5 12.5L23 15L18.5 19.5L16 17L20.5 12.5Z"
        fill="white"
      />
      <path
        d="M11.5 12.5L14 15L9 20L6.5 17.5L11.5 12.5Z"
        fill="white"
      />
      <path
        d="M16 17L18.5 19.5L16 22L13.5 19.5L16 17Z"
        fill="white"
      />
      <path
        d="M23 20L25.5 22.5L20.5 27.5L18 25L23 20Z"
        fill="white"
      />
    </svg>
  );
}

function BitcoinLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#F7931A" />
      <path
        d="M22.5 14.2c.3-2-1.2-3.1-3.3-3.8l.7-2.7-1.7-.4-.7 2.6c-.4-.1-.9-.2-1.4-.3l.7-2.7-1.7-.4-.7 2.7c-.3-.1-.7-.2-1-.3l-2.3-.6-.4 1.8s1.2.3 1.2.3c.7.2.8.6.8 1l-.8 3.2c0 0 .1 0 .1 0l-.1 0-1.1 4.5c-.1.2-.3.5-.8.4 0 0-1.2-.3-1.2-.3l-.8 1.9 2.2.5c.4.1.8.2 1.2.3l-.7 2.8 1.7.4.7-2.7c.5.1.9.2 1.4.3l-.7 2.7 1.7.4.7-2.8c2.9.5 5.1.3 6-2.3.7-2.1 0-3.3-1.5-4.1 1.1-.3 1.9-1 2.1-2.5zm-3.8 5.3c-.5 2.1-4.1 1-5.3.7l.9-3.8c1.2.3 4.9.9 4.4 3.1zm.5-5.3c-.5 1.9-3.5.9-4.4.7l.8-3.4c1 .2 4.1.7 3.6 2.7z"
        fill="white"
      />
    </svg>
  );
}

const CHAIN_LOGOS: Record<SupportedChain, React.FC<{ className?: string }>> = {
  solana: SolanaLogo,
  base: BaseLogo,
  ethereum: EthereumLogo,
  bnb: BnbLogo,
  bitcoin: BitcoinLogo,
};

interface ChainSwitcherProps {
  variant?: 'default' | 'compact';
  className?: string;
}

export function ChainSwitcher({ variant = 'default', className }: ChainSwitcherProps) {
  const { chain, setChain, chainConfig, allChains } = useChain();
  const navigate = useNavigate();
  const location = useLocation();

  const handleChainSelect = (newChain: SupportedChain) => {
    const config = CHAIN_CONFIGS[newChain];
    
    // If chain is not enabled, don't switch
    if (!config.isEnabled) {
      return;
    }
    
    setChain(newChain);
    
    // Navigate to the appropriate home for each chain
    if (newChain === 'bitcoin') {
      navigate('/btc');
    } else if (location.pathname.startsWith('/btc')) {
      // Leaving Bitcoin mode — go to home
      navigate('/');
    } else if (location.pathname.startsWith('/launch')) {
      navigate(`/launch/${newChain}`);
    }
  };

  const CurrentLogo = CHAIN_LOGOS[chain];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "flex items-center gap-1.5 h-9 px-2.5 rounded-lg",
            "bg-secondary/50 hover:bg-secondary border border-border",
            "text-foreground font-medium",
            className
          )}
        >
          <CurrentLogo className="h-5 w-5" />
          {variant === 'default' && (
            <span className="text-sm hidden sm:inline">{chainConfig.name}</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
        className="w-48 bg-card border-border"
      >
        {allChains.filter((c) => c.id === 'solana' || c.id === 'bitcoin' || c.id === 'bnb').map((c) => {
          const Logo = CHAIN_LOGOS[c.id];
          const isSelected = chain === c.id;
          const isDisabled = !c.isEnabled;
          
          return (
            <DropdownMenuItem
              key={c.id}
              onClick={() => handleChainSelect(c.id)}
              disabled={isDisabled}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 cursor-pointer",
                isSelected && "bg-primary/10",
                isDisabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <Logo className="h-5 w-5" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  {isDisabled && (
                    <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-secondary rounded">
                      Soon
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {c.nativeCurrency.symbol}
                </span>
              </div>
              {isSelected && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
