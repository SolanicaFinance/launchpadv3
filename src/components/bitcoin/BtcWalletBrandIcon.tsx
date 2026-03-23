import { BtcWalletProvider } from '@/hooks/useBtcWallet';

interface BtcWalletBrandIconProps {
  walletId: BtcWalletProvider | string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  muted?: boolean;
}

const LABELS: Record<string, string> = {
  unisat: 'U',
  xverse: 'X',
  leather: 'L',
  okx: 'OKX',
  phantom: 'P',
  unknown: 'BTC',
};

const TONES: Record<string, string> = {
  unisat: 'border-primary/25 bg-primary/15 text-primary',
  xverse: 'border-accent/30 bg-accent/20 text-foreground',
  leather: 'border-border bg-secondary text-foreground',
  okx: 'border-foreground/10 bg-foreground text-background',
  phantom: 'border-primary/20 bg-primary text-primary-foreground',
  unknown: 'border-border bg-muted text-muted-foreground',
};

const SIZES: Record<NonNullable<BtcWalletBrandIconProps['size']>, string> = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

const TYPE_STYLES: Record<string, string> = {
  unisat: 'font-black',
  xverse: 'font-black',
  leather: 'font-serif font-bold',
  okx: 'text-[9px] font-black tracking-[0.18em]',
  phantom: 'font-black',
  unknown: 'text-[10px] font-bold tracking-[0.14em]',
};

export function BtcWalletBrandIcon({ walletId, name, size = 'md', muted = false }: BtcWalletBrandIconProps) {
  const tone = TONES[walletId] || TONES.unknown;
  const label = LABELS[walletId] || LABELS.unknown;
  const typeStyle = TYPE_STYLES[walletId] || TYPE_STYLES.unknown;

  return (
    <div
      aria-label={name || walletId}
      className={[
        'flex items-center justify-center rounded-xl border shadow-sm transition-opacity',
        SIZES[size],
        tone,
        muted ? 'opacity-75' : 'opacity-100',
      ].join(' ')}
    >
      <span className={['leading-none', typeStyle].join(' ')}>{label}</span>
    </div>
  );
}
