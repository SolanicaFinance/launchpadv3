import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { X, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import type { CartItem } from "./ProductCard";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (index: number, qty: number) => void;
  onRemove: (index: number) => void;
  onCheckout: () => void;
  solPrice: number;
}

export function CartDrawer({ open, onClose, items, onUpdateQuantity, onRemove, onCheckout, solPrice }: CartDrawerProps) {
  const totalSol = items.reduce((sum, item) => sum + item.product.priceSol * item.quantity, 0);
  const totalUsd = (totalSol * solPrice).toFixed(2);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[340px] sm:w-[400px] bg-card border-l border-border p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-foreground text-sm">
            <ShoppingBag className="w-4 h-4 text-primary" />
            Cart ({items.length} item{items.length !== 1 ? "s" : ""})
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {items.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-12">
              Your cart is empty
            </div>
          ) : (
            items.map((item, i) => (
              <div key={`${item.product.id}-${item.size}-${item.color}-${i}`} className="flex gap-3 p-3 rounded-lg bg-background border border-border">
                <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-2xl flex-shrink-0">
                  {item.product.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-xs font-medium truncate">{item.product.name}</p>
                  <p className="text-muted-foreground text-[11px]">
                    {item.size && `${item.size}`}{item.size && item.color && " · "}{item.color && `${item.color}`}
                  </p>
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex items-center border border-border rounded">
                      <button onClick={() => onUpdateQuantity(i, Math.max(1, item.quantity - 1))} className="p-1 text-muted-foreground hover:text-foreground">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-1.5 text-[11px] font-medium text-foreground">{item.quantity}</span>
                      <button onClick={() => onUpdateQuantity(i, item.quantity + 1)} className="p-1 text-muted-foreground hover:text-foreground">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-primary text-xs font-bold">{(item.product.priceSol * item.quantity).toFixed(3)} SOL</span>
                  </div>
                </div>
                <button onClick={() => onRemove(i)} className="text-muted-foreground hover:text-destructive transition-colors self-start">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-border px-4 py-3 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-muted-foreground text-sm">Total</span>
              <div className="text-right">
                <span className="text-primary font-bold text-lg">{totalSol.toFixed(3)} SOL</span>
                <span className="text-muted-foreground text-xs block">≈ ${totalUsd}</span>
              </div>
            </div>
            <button onClick={onCheckout} className="w-full btn-gradient-green py-2.5 rounded-lg font-bold text-sm">
              Proceed to Checkout
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
