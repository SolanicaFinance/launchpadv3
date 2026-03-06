import { ShoppingBag } from "lucide-react";
import saturnMerchLogo from "@/assets/saturn-merch-logo.png";

interface MerchHeaderProps {
  cartCount: number;
  onCartOpen: () => void;
}

export function MerchHeader({ cartCount, onCartOpen }: MerchHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <img src={saturnMerchLogo} alt="Saturn Trade" className="w-10 h-10 object-contain" />
        <div>
          <h1 className="text-foreground font-bold text-xl sm:text-2xl">Saturn Merch</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">Official Saturn Trade merchandise — pay with SOL</p>
        </div>
      </div>
      <button onClick={onCartOpen} className="relative p-2 rounded-lg border border-border hover:border-primary/50 hover:bg-surface-hover/50 transition-all">
        <ShoppingBag className="w-5 h-5 text-foreground" />
        {cartCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {cartCount}
          </span>
        )}
      </button>
    </div>
  );
}
