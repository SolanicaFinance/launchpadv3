import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import saturnMerchLogo from "@/assets/saturn-logo.png";
import { BRAND } from "@/config/branding";

export interface Product {
  id: string;
  name: string;
  description: string;
  priceSol: number;
  category: "apparel" | "accessory" | "sticker";
  sizes?: string[];
  colors?: { name: string; hex: string }[];
  bgGradient: string;
  emoji: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  size?: string;
  color?: string;
}

interface ProductCardProps {
  product: Product;
  solPrice: number;
  onAddToCart: (item: CartItem) => void;
}

export function ProductCard({ product, solPrice, onAddToCart }: ProductCardProps) {
  const [selectedSize, setSelectedSize] = useState(product.sizes?.[1] || "");
  const [selectedColor, setSelectedColor] = useState(product.colors?.[0]?.name || "");
  const [quantity, setQuantity] = useState(1);

  const usdPrice = (product.priceSol * solPrice).toFixed(2);

  const handleAdd = () => {
    onAddToCart({
      product,
      quantity,
      size: selectedSize || undefined,
      color: selectedColor || undefined,
    });
    setQuantity(1);
  };

  return (
    <div className="group relative bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_20px_hsl(var(--primary)/0.15)]">
      {/* Product mockup */}
      <div className={cn("relative h-52 flex items-center justify-center overflow-hidden", product.bgGradient)}>
        <span className="text-6xl select-none">{product.emoji}</span>
        <img
          src={saturnMerchLogo}
          alt={BRAND.name}
          className="absolute w-16 h-16 object-contain opacity-90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
          style={{ bottom: "16px", right: "16px" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
      </div>

      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-bold text-foreground text-sm">{product.name}</h3>
          <p className="text-muted-foreground text-xs mt-0.5">{product.description}</p>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-2">
          <span className="text-primary font-bold text-lg">{product.priceSol} SOL</span>
          <span className="text-muted-foreground text-xs">≈ ${usdPrice}</span>
        </div>

        {/* Size selector */}
        {product.sizes && (
          <div className="flex gap-1.5 flex-wrap">
            {product.sizes.map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                className={cn(
                  "px-2 py-1 text-[11px] font-medium rounded border transition-colors",
                  selectedSize === size
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border text-muted-foreground hover:border-muted-foreground"
                )}
              >
                {size}
              </button>
            ))}
          </div>
        )}

        {/* Color selector */}
        {product.colors && (
          <div className="flex gap-1.5">
            {product.colors.map((color) => (
              <button
                key={color.name}
                onClick={() => setSelectedColor(color.name)}
                title={color.name}
                className={cn(
                  "w-6 h-6 rounded-full border-2 transition-all",
                  selectedColor === color.name
                    ? "border-primary scale-110"
                    : "border-border hover:border-muted-foreground"
                )}
                style={{ backgroundColor: color.hex }}
              />
            ))}
          </div>
        )}

        {/* Quantity + Add to cart */}
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="px-2 text-xs font-medium text-foreground min-w-[20px] text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <button
            onClick={handleAdd}
            className="flex-1 btn-gradient-green py-2 rounded text-xs font-bold transition-all hover:opacity-90"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
