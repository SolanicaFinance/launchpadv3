import { useState, useCallback } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSolPrice } from "@/hooks/useSolPrice";
import { MerchHeader } from "@/components/merch/MerchHeader";
import { ProductCard, type Product, type CartItem } from "@/components/merch/ProductCard";
import { CartDrawer } from "@/components/merch/CartDrawer";
import { CheckoutFlow } from "@/components/merch/CheckoutFlow";

const PRODUCTS: Product[] = [
  {
    id: "tshirt-classic",
    name: "Saturn Classic Tee",
    description: "Premium cotton tee with Saturn Trade logo",
    priceSol: 0.25,
    category: "apparel",
    sizes: ["S", "M", "L", "XL", "2XL"],
    colors: [
      { name: "Black", hex: "#0a0a0a" },
      { name: "White", hex: "#f5f5f5" },
      { name: "Navy", hex: "#1e2a3a" },
    ],
    bgGradient: "bg-gradient-to-br from-zinc-900 to-zinc-800",
    emoji: "👕",
  },
  {
    id: "hoodie-pro",
    name: "Saturn Pro Hoodie",
    description: "Heavyweight hoodie with embroidered logo",
    priceSol: 0.5,
    category: "apparel",
    sizes: ["S", "M", "L", "XL", "2XL"],
    colors: [
      { name: "Black", hex: "#0a0a0a" },
      { name: "Charcoal", hex: "#2a2a2a" },
    ],
    bgGradient: "bg-gradient-to-br from-zinc-800 to-zinc-700",
    emoji: "🧥",
  },
  {
    id: "hat-snapback",
    name: "Saturn Snapback",
    description: "Structured snapback with embroidered Saturn logo",
    priceSol: 0.15,
    category: "accessory",
    colors: [
      { name: "Black", hex: "#0a0a0a" },
      { name: "Green", hex: "#4ade80" },
    ],
    bgGradient: "bg-gradient-to-br from-emerald-900/40 to-zinc-900",
    emoji: "🧢",
  },
  {
    id: "hat-beanie",
    name: "Saturn Beanie",
    description: "Knit beanie with woven Saturn patch",
    priceSol: 0.12,
    category: "accessory",
    colors: [
      { name: "Black", hex: "#0a0a0a" },
      { name: "Gray", hex: "#6b7280" },
    ],
    bgGradient: "bg-gradient-to-br from-slate-800 to-zinc-900",
    emoji: "🎿",
  },
  {
    id: "sticker-pack",
    name: "Saturn Sticker Pack",
    description: "5 die-cut vinyl stickers — weatherproof",
    priceSol: 0.05,
    category: "sticker",
    bgGradient: "bg-gradient-to-br from-primary/20 to-zinc-900",
    emoji: "✨",
  },
  {
    id: "mug-ceramic",
    name: "Saturn Ceramic Mug",
    description: "11oz ceramic mug, dishwasher safe",
    priceSol: 0.1,
    category: "accessory",
    colors: [
      { name: "Black", hex: "#0a0a0a" },
      { name: "White", hex: "#f5f5f5" },
    ],
    bgGradient: "bg-gradient-to-br from-amber-900/30 to-zinc-900",
    emoji: "☕",
  },
  {
    id: "phone-case",
    name: "Saturn Phone Case",
    description: "Slim protective case with Saturn design",
    priceSol: 0.12,
    category: "accessory",
    bgGradient: "bg-gradient-to-br from-violet-900/30 to-zinc-900",
    emoji: "📱",
  },
  {
    id: "tshirt-dev",
    name: "Saturn Dev Tee",
    description: '"I build on Saturn" limited edition tee',
    priceSol: 0.3,
    category: "apparel",
    sizes: ["S", "M", "L", "XL", "2XL"],
    colors: [
      { name: "Black", hex: "#0a0a0a" },
      { name: "Dark Green", hex: "#14532d" },
    ],
    bgGradient: "bg-gradient-to-br from-green-900/40 to-zinc-900",
    emoji: "💻",
  },
];

export default function MerchStorePage() {
  const isMobile = useIsMobile();
  const { solPrice } = useSolPrice();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState(false);

  const addToCart = useCallback((item: CartItem) => {
    setCart((prev) => {
      const existing = prev.findIndex(
        (c) => c.product.id === item.product.id && c.size === item.size && c.color === item.color
      );
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + item.quantity };
        return updated;
      }
      return [...prev, item];
    });
    setCartOpen(true);
  }, []);

  const updateQuantity = (index: number, qty: number) => {
    setCart((prev) => prev.map((item, i) => (i === index ? { ...item, quantity: qty } : item)));
  };

  const removeItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const totalSol = cart.reduce((sum, item) => sum + item.product.priceSol * item.quantity, 0);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className={isMobile ? "px-3 pt-4 pb-24" : "ml-[48px] px-6 pt-6 pb-24"}>
        <div className="max-w-6xl mx-auto">
          <MerchHeader cartCount={cart.length} onCartOpen={() => setCartOpen(true)} />

          {checkoutMode ? (
            <CheckoutFlow
              items={cart}
              totalSol={totalSol}
              solPrice={solPrice}
              onBack={() => setCheckoutMode(false)}
              onComplete={() => {
                setCart([]);
                setCheckoutMode(false);
              }}
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {PRODUCTS.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  solPrice={solPrice}
                  onAddToCart={addToCart}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        onUpdateQuantity={updateQuantity}
        onRemove={removeItem}
        onCheckout={() => {
          setCartOpen(false);
          setCheckoutMode(true);
        }}
        solPrice={solPrice}
      />
    </div>
  );
}
