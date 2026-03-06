import { useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2, Copy, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { CartItem } from "./ProductCard";

const TREASURY_WALLET = "HSVmkUnmjD9YLJmgeHCRyL1isusKkU3xv4VwDaZJqRx";

interface CheckoutFlowProps {
  items: CartItem[];
  totalSol: number;
  solPrice: number;
  onBack: () => void;
  onComplete: () => void;
}

interface ShippingInfo {
  name: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export function CheckoutFlow({ items, totalSol, solPrice, onBack, onComplete }: CheckoutFlowProps) {
  const [step, setStep] = useState<"shipping" | "payment" | "confirmation">("shipping");
  const [shipping, setShipping] = useState<ShippingInfo>({ name: "", email: "", address: "", city: "", state: "", zip: "", country: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [txSignature, setTxSignature] = useState("");
  const { toast } = useToast();

  const totalUsd = (totalSol * solPrice).toFixed(2);

  const generateOrderNumber = () => `SAT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const isShippingValid = shipping.name && shipping.email && shipping.address && shipping.city && shipping.zip && shipping.country;

  const handleSubmitOrder = async () => {
    setIsSubmitting(true);
    try {
      const ordNum = generateOrderNumber();
      setOrderNumber(ordNum);

      // Save order to database
      const { error } = await supabase.from("merch_orders" as any).insert({
        order_number: ordNum,
        buyer_email: shipping.email,
        shipping_name: shipping.name,
        shipping_address: {
          address: shipping.address,
          city: shipping.city,
          state: shipping.state,
          zip: shipping.zip,
          country: shipping.country,
        },
        items: items.map((i) => ({
          id: i.product.id,
          name: i.product.name,
          size: i.size,
          color: i.color,
          quantity: i.quantity,
          priceSol: i.product.priceSol,
        })),
        total_sol: totalSol,
        status: "pending",
      } as any);

      if (error) throw error;

      setStep("confirmation");
      toast({ title: "Order placed!", description: `Order ${ordNum} created. Please send ${totalSol.toFixed(3)} SOL to complete.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to place order", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!" });
  };

  if (step === "shipping") {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to cart
        </button>

        <h2 className="text-foreground font-bold text-lg">Shipping Information</h2>

        <div className="space-y-3">
          {[
            { key: "name", label: "Full Name", placeholder: "John Doe" },
            { key: "email", label: "Email", placeholder: "john@example.com", type: "email" },
            { key: "address", label: "Street Address", placeholder: "123 Main St" },
            { key: "city", label: "City", placeholder: "New York" },
            { key: "state", label: "State/Province", placeholder: "NY" },
            { key: "zip", label: "ZIP/Postal Code", placeholder: "10001" },
            { key: "country", label: "Country", placeholder: "United States" },
          ].map(({ key, label, placeholder, type }) => (
            <div key={key}>
              <label className="text-muted-foreground text-xs font-medium block mb-1">{label}</label>
              <input
                type={type || "text"}
                placeholder={placeholder}
                value={shipping[key as keyof ShippingInfo]}
                onChange={(e) => setShipping({ ...shipping, [key]: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          ))}
        </div>

        {/* Order summary */}
        <div className="bg-background border border-border rounded-lg p-3 space-y-2">
          <h3 className="text-foreground text-xs font-bold">Order Summary</h3>
          {items.map((item, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {item.product.name} {item.size && `(${item.size})`} × {item.quantity}
              </span>
              <span className="text-foreground">{(item.product.priceSol * item.quantity).toFixed(3)} SOL</span>
            </div>
          ))}
          <div className="border-t border-border pt-2 flex justify-between">
            <span className="text-foreground text-sm font-bold">Total</span>
            <div className="text-right">
              <span className="text-primary font-bold">{totalSol.toFixed(3)} SOL</span>
              <span className="text-muted-foreground text-xs block">≈ ${totalUsd}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setStep("payment")}
          disabled={!isShippingValid}
          className="w-full btn-gradient-green py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue to Payment <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (step === "payment") {
    return (
      <div className="space-y-4">
        <button onClick={() => setStep("shipping")} className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h2 className="text-foreground font-bold text-lg">Payment</h2>

        <div className="bg-background border border-border rounded-lg p-4 space-y-3">
          <p className="text-muted-foreground text-sm">Send the exact amount to complete your order:</p>
          
          <div className="text-center py-4">
            <span className="text-primary font-bold text-3xl">{totalSol.toFixed(3)} SOL</span>
            <span className="text-muted-foreground text-sm block mt-1">≈ ${totalUsd} USD</span>
          </div>

          <div>
            <label className="text-muted-foreground text-xs font-medium block mb-1">Send to this wallet address:</label>
            <div className="flex items-center gap-2 bg-card border border-border rounded p-2">
              <code className="text-foreground text-[11px] break-all flex-1 font-mono">{TREASURY_WALLET}</code>
              <button onClick={() => copyToClipboard(TREASURY_WALLET)} className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="text-muted-foreground text-xs font-medium block mb-1">Transaction Signature (optional)</label>
            <input
              type="text"
              placeholder="Paste your tx signature here..."
              value={txSignature}
              onChange={(e) => setTxSignature(e.target.value)}
              className="w-full px-3 py-2 bg-card border border-border rounded text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors font-mono text-xs"
            />
          </div>
        </div>

        <button
          onClick={handleSubmitOrder}
          disabled={isSubmitting}
          className="w-full btn-gradient-green py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {isSubmitting ? "Placing Order..." : "Confirm Order"}
        </button>
      </div>
    );
  }

  // Confirmation step
  return (
    <div className="space-y-4 text-center py-6">
      <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-8 h-8 text-primary" />
      </div>

      <div>
        <h2 className="text-foreground font-bold text-xl">Order Confirmed! 🪐</h2>
        <p className="text-muted-foreground text-sm mt-1">Thank you for your purchase</p>
      </div>

      <div className="bg-background border border-border rounded-lg p-4 space-y-2 text-left">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Order Number</span>
          <span className="text-foreground font-mono font-bold">{orderNumber}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="text-primary font-bold">{totalSol.toFixed(3)} SOL</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Email</span>
          <span className="text-foreground">{shipping.email}</span>
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        We'll send a confirmation email with tracking details once your order ships.
      </p>

      <button onClick={onComplete} className="btn-gradient-green px-8 py-2.5 rounded-lg font-bold text-sm">
        Continue Shopping
      </button>
    </div>
  );
}
