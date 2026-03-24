import { BtcWalletProvider } from '@/hooks/useBtcWallet';
import unisatLogo from '@/assets/wallets/unisat.png';
import xverseLogo from '@/assets/wallets/xverse.png';
import leatherLogo from '@/assets/wallets/leather.png';
import okxLogo from '@/assets/wallets/okx.png';
import phantomLogo from '@/assets/wallets/phantom.png';

interface BtcWalletBrandIconProps {
  walletId: BtcWalletProvider | string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  muted?: boolean;
}

const LOGOS: Record<string, string> = {
  unisat: unisatLogo,
  xverse: xverseLogo,
  leather: leatherLogo,
  okx: okxLogo,
  phantom: phantomLogo,
};

const LABELS: Record<string, string> = {
  unisat: 'U',
  xverse: 'X',
  leather: 'L',
  okx: 'OKX',
  phantom: 'P',
  unknown: 'BTC',
};

const SIZES: Record<NonNullable<BtcWalletBrandIconProps['size']>, { container: string; img: number }> = {
  sm: { container: 'h-9 w-9', img: 24 },
  md: { container: 'h-10 w-10', img: 28 },
  lg: { container: 'h-12 w-12', img: 32 },
};

export function BtcWalletBrandIcon({ walletId, name, size = 'md', muted = false }: BtcWalletBrandIconProps) {
  const logo = LOGOS[walletId];
  const sizeConfig = SIZES[size];

  if (logo) {
    return (
      <div
        aria-label={name || walletId}
        className={`flex items-center justify-center rounded-xl bg-background border border-border shadow-sm overflow-hidden ${sizeConfig.container} ${muted ? 'opacity-60' : ''}`}
      >
        <img
          src={logo}
          alt={name || walletId}
          width={sizeConfig.img}
          height={sizeConfig.img}
          className="object-contain"
          loading="lazy"
        />
      </div>
    );
  }

  // Fallback letter icon
  const label = LABELS[walletId] || LABELS.unknown;
  return (
    <div
      aria-label={name || walletId}
      className={`flex items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground shadow-sm text-sm font-bold ${sizeConfig.container} ${muted ? 'opacity-60' : ''}`}
    >
      {label}
    </div>
  );
}
