import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, ExternalLink, Loader2, Megaphone, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useTokenPromotions } from "@/hooks/useTokenPromotions";
import QRCode from "react-qr-code";

interface PromoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenId: string;
  tokenName: string;
  tokenTicker: string;
  promoterWallet: string;
}

export function PromoteModal({
  isOpen,
  onClose,
  tokenId,
  tokenName,
  tokenTicker,
  promoterWallet,
}: PromoteModalProps) {
  const [paymentAddress, setPaymentAddress] = useState<string | null>(null);
  const [promotionId, setPromotionId] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "pending" | "paid" | "posted" | "error" | "expired">("loading");
  const [copied, setCopied] = useState(false);
  const [tweetUrl, setTweetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { generatePromotion, checkPromotion } = useTokenPromotions();

  // Generate payment address on open (no wallet connection required)
  useEffect(() => {
    if (isOpen && !paymentAddress) {
      setStatus("loading");
      setError(null);
      
      generatePromotion.mutate(
        { funTokenId: tokenId, promoterWallet },
        {
          onSuccess: (data) => {
            if (data.success && data.paymentAddress) {
              setPaymentAddress(data.paymentAddress);
              setPromotionId(data.promotionId || null);
              setStatus("pending");
            } else {
              setError(data.error || "Failed to generate payment address");
              setStatus("error");
            }
          },
          onError: (err) => {
            setError(err.message);
            setStatus("error");
          },
        }
      );
    }
  }, [isOpen, paymentAddress, tokenId, promoterWallet, generatePromotion]);

  // Poll for payment status
  useEffect(() => {
    if (!promotionId || status !== "pending") return;

    const interval = setInterval(() => {
      checkPromotion.mutate(promotionId, {
        onSuccess: (data) => {
          if (data.paid) {
            setStatus("paid");
            if (data.tweetId) {
              setTweetUrl(`https://twitter.com/clawmode/status/${data.tweetId}`);
              setStatus("posted");
            }
          } else if (data.status === "expired") {
            setStatus("expired");
            setError("Payment window expired. Please try again.");
          }
        },
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [promotionId, status]);

  const handleCopy = useCallback(() => {
    if (paymentAddress) {
      navigator.clipboard.writeText(paymentAddress);
      setCopied(true);
      toast.success("Address copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  }, [paymentAddress]);

  const handleClose = () => {
    setPaymentAddress(null);
    setPromotionId(null);
    setStatus("loading");
    setError(null);
    setTweetUrl(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-yellow-500" />
            Promote {tokenName} (${tokenTicker})
          </DialogTitle>
          <DialogDescription>
            Pay 1 SOL to promote this token on @saturntrade's X account for 24 hours.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {status === "loading" && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-sm text-muted-foreground">Generating payment address...</p>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="mt-2 text-sm text-destructive">{error}</p>
              <Button variant="outline" onClick={handleClose} className="mt-4">
                Close
              </Button>
            </div>
          )}

          {status === "pending" && paymentAddress && (
            <>
              {/* QR Code */}
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <QRCode value={`solana:${paymentAddress}?amount=1`} size={180} />
              </div>

              {/* Amount */}
              <div className="text-center">
                <Badge className="text-lg px-4 py-2 bg-gradient-to-r from-warning/20 to-warning/30 text-warning border-warning/30">
                  1 SOL
                </Badge>
              </div>

              {/* Payment Address */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Send SOL to:</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-3 bg-muted rounded-lg text-xs break-all font-mono">
                    {paymentAddress}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Waiting for payment...
              </div>

              {/* Disclaimer */}
              <p className="text-xs text-muted-foreground text-center">
                Once payment is confirmed, your token will be promoted on @saturntrade's X account
                with a "PAID PROMOTION" disclosure.
              </p>
            </>
          )}

          {status === "paid" && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Payment Confirmed!</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Your promotional tweet is being posted...
              </p>
              <Loader2 className="h-6 w-6 animate-spin mt-4" />
            </div>
          )}

          {status === "posted" && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-primary">Promotion Live!</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Your token has been promoted on @saturntrade's X account.
                <br />
                The promotion will be active for 24 hours.
              </p>
              {tweetUrl && (
                <Button
                  variant="outline"
                  className="mt-4 gap-2"
                  onClick={() => window.open(tweetUrl, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                  View Tweet
                </Button>
              )}
              <Button variant="ghost" onClick={handleClose} className="mt-2">
                Close
              </Button>
            </div>
          )}

          {status === "expired" && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-8 w-8 text-warning" />
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" onClick={handleClose} className="mt-4">
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
