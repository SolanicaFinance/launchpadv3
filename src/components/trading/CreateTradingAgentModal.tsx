import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Bot, Shield, Target, Zap, Copy, Check, Wallet, Loader2, Sparkles, ExternalLink, Coins, FileCode, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCreateTradingAgent } from "@/hooks/useTradingAgents";
import { supabase } from "@/integrations/supabase/client";
import clawLogo from "@/assets/saturn-logo.png";

const formSchema = z.object({
  name: z.string().optional(),
  ticker: z.string().max(6).optional(),
  description: z.string().max(500).optional(),
  strategy: z.enum(["conservative", "balanced", "aggressive"]),
  personality: z.string().max(200).optional(),
   twitterUrl: z.string().url().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateTradingAgentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const strategies = [
  {
    id: "conservative" as const,
    name: "Conservative",
    icon: Shield,
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    hoverBorder: "hover:border-green-500/50",
    stopLoss: "10%",
    takeProfit: "25%",
    positions: "2 max",
    description: "Lower risk, steady gains",
  },
  {
    id: "balanced" as const,
    name: "Balanced",
    icon: Target,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    hoverBorder: "hover:border-amber-500/50",
    stopLoss: "20%",
    takeProfit: "50%",
    positions: "3 max",
    description: "Moderate risk-reward",
  },
  {
    id: "aggressive" as const,
    name: "Aggressive",
    icon: Zap,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    hoverBorder: "hover:border-red-500/50",
    stopLoss: "30%",
    takeProfit: "100%",
    positions: "5 max",
    description: "High risk, high reward",
  },
];

export function CreateTradingAgentModal({ open, onOpenChange }: CreateTradingAgentModalProps) {
  const { toast } = useToast();
  const createAgent = useCreateTradingAgent();
  const [createdAgent, setCreatedAgent] = useState<{
    name: string;
    walletAddress: string;
    ticker: string;
     mintAddress?: string;
     avatarUrl?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedMint, setCopiedMint] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAvatar, setGeneratedAvatar] = useState<string | null>(null);
  const [customImageFile, setCustomImageFile] = useState<File | null>(null);
  const [customImagePreview, setCustomImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      strategy: "balanced",
      name: "",
      ticker: "",
      description: "",
      personality: "",
       twitterUrl: "",
    },
  });

  const selectedStrategy = form.watch("strategy");

  const handleGenerate = async () => {
    setIsGenerating(true);
    // Clear custom image when generating AI avatar
    setCustomImageFile(null);
    setCustomImagePreview(null);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trading-agent-generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            strategy: form.getValues("strategy"),
          }),
        }
      );
      const result = await response.json();
      if (result.success) {
        form.setValue("name", result.name);
        form.setValue("ticker", result.ticker);
        form.setValue("description", result.description);
        if (result.personality) {
          form.setValue("personality", result.personality);
        }
        if (result.avatarUrl) {
          setGeneratedAvatar(result.avatarUrl);
        }
        toast({
          title: "Character Generated",
          description: `${result.name} is ready to customize.`,
        });
      } else {
        throw new Error(result.error || "Generation failed");
      }
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate agent character",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload PNG, JPG, or WebP images only",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Image too large",
        description: "Maximum file size is 2MB",
        variant: "destructive",
      });
      return;
    }

    setCustomImageFile(file);
    setCustomImagePreview(URL.createObjectURL(file));
    setGeneratedAvatar(null); // Clear AI avatar when custom is uploaded
  };

  const handleClearCustomImage = () => {
    setCustomImageFile(null);
    setCustomImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCopyAddress = async () => {
    if (createdAgent?.walletAddress) {
      await navigator.clipboard.writeText(createdAgent.walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyMintAddress = async () => {
    if (createdAgent?.mintAddress) {
      await navigator.clipboard.writeText(createdAgent.mintAddress);
      setCopiedMint(true);
      setTimeout(() => setCopiedMint(false), 2000);
    }
  };

  const onSubmit = async (values: FormValues) => {
    try {
      let finalAvatarUrl = generatedAvatar;

      // Upload custom image if provided
      if (customImageFile) {
        setIsUploadingImage(true);
        try {
          const ext = customImageFile.name.split('.').pop() || 'png';
          const fileName = `trading-agent-${Date.now()}.${ext}`;
          
          const { error: uploadError } = await supabase.storage
            .from("trading-agents")
            .upload(fileName, customImageFile, { upsert: true });
          
          if (uploadError) {
            throw new Error("Failed to upload image: " + uploadError.message);
          }
          
          const { data: { publicUrl } } = supabase.storage
            .from("trading-agents")
            .getPublicUrl(fileName);
          
          finalAvatarUrl = publicUrl;
        } finally {
          setIsUploadingImage(false);
        }
      }

      const result = await createAgent.mutateAsync({
        name: values.name,
        ticker: values.ticker,
        description: values.description,
        strategy: values.strategy,
        personalityPrompt: values.personality,
        avatarUrl: finalAvatarUrl || undefined,
        twitterUrl: values.twitterUrl || undefined,
      });

      if (result.success) {
        setCreatedAgent({
          name: result.tradingAgent.name,
          walletAddress: result.tradingAgent.walletAddress,
          ticker: result.tradingAgent.ticker,
          mintAddress: result.tradingAgent.mintAddress,
          avatarUrl: result.tradingAgent.avatarUrl || finalAvatarUrl || undefined,
        });
        toast({
          title: "Trading Agent Created!",
          description: `${result.tradingAgent.name} is ready. Fund the wallet to start trading.`,
        });
      } else {
        throw new Error(result.error || "Failed to create trading agent");
      }
    } catch (error) {
      toast({
        title: "Creation Failed",
        description: error instanceof Error ? error.message : "Failed to create trading agent",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setCreatedAgent(null);
    setGeneratedAvatar(null);
    setCustomImageFile(null);
    setCustomImagePreview(null);
    form.reset();
    onOpenChange(false);
  };

  // Determine which avatar to display
  const displayAvatar = customImagePreview || generatedAvatar;

  // Success state
  if (createdAgent) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-green-400" />
              Agent Created Successfully!
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="text-center">
              {createdAgent.avatarUrl ? (
                <img 
                  src={createdAgent.avatarUrl} 
                  alt={createdAgent.name}
                  className="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-green-500/50 object-cover"
                />
              ) : (
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 mb-4">
                  <Check className="h-8 w-8 text-green-400" />
                </div>
              )}
              <h3 className="text-xl font-bold">{createdAgent.name}</h3>
              <Badge variant="outline" className="mt-2">${createdAgent.ticker}</Badge>
            </div>

            {/* Contract Address (CA) - shown first */}
            {createdAgent.mintAddress ? (
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-medium text-green-400 flex items-center gap-1">
                    <FileCode className="h-4 w-4" />
                    Contract Address (CA)
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={handleCopyMintAddress}
                  >
                    {copiedMint ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <code className="text-xs break-all text-foreground">
                  {createdAgent.mintAddress}
                </code>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <FileCode className="h-4 w-4" />
                  Token launch pending — CA will appear on profile
                </span>
              </div>
            )}

            {/* Trading Wallet */}
            <div className="p-4 rounded-lg bg-secondary/50 border border-border">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Wallet className="h-4 w-4" />
                  Trading Wallet
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={handleCopyAddress}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <code className="text-xs break-all text-foreground">
                {createdAgent.walletAddress}
              </code>
            </div>

             {/* Funding Progress */}
             <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
               <div className="flex items-center gap-2 mb-3">
                 <Coins className="h-4 w-4 text-amber-400" />
                 <span className="font-medium text-amber-400">Funding Progress</span>
               </div>
               <div className="space-y-2">
                 <Progress value={0} className="h-2" />
                 <div className="flex justify-between text-xs">
                   <span className="text-muted-foreground">0 / 0.5 SOL</span>
                   <span className="text-muted-foreground">0%</span>
                 </div>
               </div>
               <p className="text-xs text-muted-foreground mt-3">
                 Fees from token swaps will automatically fund the trading wallet.
                 Trading activates once 0.5 SOL is reached.
               </p>
             </div>

             {/* Quick Links */}
             <div className="grid grid-cols-2 gap-3">
               {createdAgent.mintAddress && (
                 <Link to={`/trade/${createdAgent.mintAddress}`} onClick={handleClose}>
                   <Button variant="outline" className="w-full gap-2">
                     <ExternalLink className="h-4 w-4" />
                     Trade Token
                   </Button>
                 </Link>
               )}
               <Link to={`/t/${createdAgent.ticker}`} onClick={handleClose}>
                 <Button variant="outline" className="w-full gap-2">
                   <Bot className="h-4 w-4" />
                   Community
                 </Button>
               </Link>
             </div>

            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-amber-400" />
            Create Trading Agent
          </DialogTitle>
          <DialogDescription>
            Deploy an autonomous AI agent that trades based on your chosen strategy. 
            <Badge variant="outline" className="ml-2 text-amber-400 border-amber-500/30">BETA</Badge>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Strategy Selection */}
              <FormField
                control={form.control}
                name="strategy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trading Strategy *</FormLabel>
                    <div className="grid grid-cols-3 gap-2">
                      {strategies.map((strategy) => {
                        const Icon = strategy.icon;
                        const isSelected = field.value === strategy.id;
                        return (
                          <button
                            key={strategy.id}
                            type="button"
                            onClick={() => field.onChange(strategy.id)}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              isSelected 
                                ? `${strategy.bgColor} ${strategy.borderColor}` 
                                : `bg-background/50 border-border ${strategy.hoverBorder}`
                            }`}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <Icon className={`h-4 w-4 ${strategy.color}`} />
                              <span className="font-medium text-sm">{strategy.name}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mb-2">{strategy.description}</p>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="outline" className="text-[9px] px-1 py-0">SL {strategy.stopLoss}</Badge>
                              <Badge variant="outline" className="text-[9px] px-1 py-0">TP {strategy.takeProfit}</Badge>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

             {/* Avatar Section with Generate & Upload Options */}
             <div className="p-4 rounded-lg bg-secondary/30 border border-border space-y-3">
               <div className="flex items-center gap-4">
                 <div className="relative">
                   {displayAvatar ? (
                     <div className="relative">
                       <img
                         src={displayAvatar}
                         alt="Avatar preview"
                         className="w-16 h-16 rounded-lg object-cover border-2 border-amber-500/50"
                       />
                       {customImagePreview && (
                         <button
                           type="button"
                           onClick={handleClearCustomImage}
                           className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/80"
                         >
                           <X className="h-3 w-3" />
                         </button>
                       )}
                     </div>
                   ) : (
                     <div className="w-16 h-16 rounded-lg bg-background/50 border border-dashed border-border flex items-center justify-center">
                       <Bot className="h-6 w-6 text-muted-foreground" />
                     </div>
                   )}
                 </div>
                 <div className="flex-1 space-y-2">
                   <Button
                     type="button"
                     variant="outline"
                     onClick={handleGenerate}
                     disabled={isGenerating}
                     className="w-full border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/10"
                   >
                     {isGenerating ? (
                       <>
                         <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                         Generating...
                       </>
                     ) : (
                       <>
                         <img src={clawLogo} alt="" className="h-4 w-4 mr-2" />
                         <Sparkles className="h-3 w-3 mr-1" />
                         Generate Character
                       </>
                     )}
                   </Button>
                   <Button
                     type="button"
                     variant="outline"
                     onClick={() => fileInputRef.current?.click()}
                     className="w-full"
                   >
                     <Upload className="h-4 w-4 mr-2" />
                     Upload Custom Image
                   </Button>
                   <input
                     ref={fileInputRef}
                     type="file"
                     accept="image/png,image/jpeg,image/jpg,image/webp"
                     onChange={handleImageUpload}
                     className="hidden"
                   />
                 </div>
               </div>
               <p className="text-[10px] text-muted-foreground text-center">
                 {customImagePreview 
                   ? "Using custom image • Click X to remove" 
                   : generatedAvatar 
                     ? "Using AI-generated avatar" 
                     : "Generate a character or upload your own image (max 2MB)"}
               </p>
             </div>

              {/* Optional Fields */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="AI generates if empty" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ticker"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ticker (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. ALPHA" maxLength={6} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="AI generates a description if empty" 
                        className="resize-none"
                        rows={2}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="personality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Personality (auto-generated)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Generated with character" 
                        disabled
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      AI-generated personality trait based on strategy
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

               <FormField
                 control={form.control}
                 name="twitterUrl"
                 render={({ field }) => (
                   <FormItem>
                     <FormLabel>X/Twitter URL (optional)</FormLabel>
                     <FormControl>
                       <Input 
                         placeholder="https://x.com/yourprofile" 
                         {...field} 
                       />
                     </FormControl>
                     <FormDescription>
                       Link to X profile for on-chain token metadata
                     </FormDescription>
                     <FormMessage />
                   </FormItem>
                 )}
               />

              {/* Submit */}
              <div className="flex gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createAgent.isPending || isUploadingImage}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 text-black hover:from-amber-600 hover:to-yellow-600"
                >
                  {isUploadingImage ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : createAgent.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Bot className="h-4 w-4 mr-2" />
                      Create Agent
                    </>
                  )}
                </Button>
              </div>

              {/* Disclaimer */}
              <p className="text-[10px] text-muted-foreground text-center">
                By creating a trading agent, you acknowledge that autonomous trading involves risk. 
                You are responsible for funding and managing your agent.
              </p>
            </form>
          </Form>
      </DialogContent>
    </Dialog>
  );
}
