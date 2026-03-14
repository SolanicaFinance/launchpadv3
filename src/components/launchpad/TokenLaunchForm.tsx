import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Image,
  X,
  Download,
  Globe,
  Twitter,
  MessageCircle,
  Bot,
} from "lucide-react";

interface TokenData {
  name: string;
  ticker: string;
  description: string;
  imageUrl: string;
  websiteUrl?: string;
  twitterUrl?: string;
  telegramUrl?: string;
  discordUrl?: string;
}

interface TokenLaunchFormProps {
  token: TokenData;
  setToken: (token: TokenData) => void;
  imagePreview: string | null;
  memeImageUrl?: string;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearImage: () => void;
}

export function TokenLaunchForm({
  token,
  setToken,
  imagePreview,
  memeImageUrl,
  onImageChange,
  onClearImage,
}: TokenLaunchFormProps) {
  const currentImage = imagePreview || memeImageUrl || token.imageUrl;
  const hasImage = !!currentImage;

  const handleDownload = () => {
    if (!currentImage) return;
    const a = document.createElement("a");
    a.href = currentImage;
    a.download = `${(token.ticker || "token").toLowerCase()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-4">
      {/* Image */}
      <div className="phantom-image-upload-area">
        {hasImage ? (
          <div className="relative w-full h-full group">
            <img src={currentImage} alt="Token" className="w-full h-full object-cover rounded-xl" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-xl flex items-center justify-center">
              <label className="cursor-pointer text-white/80 text-xs font-medium flex items-center gap-1.5 hover:text-white transition-colors">
                <Image className="h-4 w-4" />
                Change
                <input type="file" accept="image/*" onChange={onImageChange} className="hidden" />
              </label>
            </div>
            <button
              onClick={onClearImage}
              className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors z-10 shadow-lg cursor-pointer"
              title="Remove image"
            >
              <X className="h-3.5 w-3.5 text-white" />
            </button>
          </div>
        ) : (
          <label className="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center group-hover:bg-white/[0.08] transition-colors duration-200">
              <Image className="h-5 w-5 text-white/25 group-hover:text-primary/60 transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-[11px] text-white/40 font-medium">Upload PNG/JPG/SVG</p>
              <p className="text-[9px] text-white/20 mt-0.5">(max 5MB)</p>
            </div>
            <input type="file" accept="image/*" onChange={onImageChange} className="hidden" />
          </label>
        )}
      </div>

      {/* Download button under image */}
      {hasImage && (
        <button
          onClick={handleDownload}
          className="w-full h-9 rounded-lg bg-green-600/15 hover:bg-green-600/25 border border-green-600/30 text-green-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          Download Image
        </button>
      )}

      {/* Token Name */}
      <div className="space-y-1">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30 pl-1">Token Name</label>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
            <Bot className="h-4 w-4 text-white/30" />
          </div>
          <Input
            value={token.name}
            onChange={(e) => setToken({ ...token, name: e.target.value.slice(0, 32) })}
            className="phantom-glass-input h-10 rounded-xl flex-1"
            placeholder="e.g. Pepe"
            maxLength={32}
          />
        </div>
      </div>

      {/* Ticker */}
      <div className="space-y-1">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30 pl-1">Ticker</label>
        <div className="flex items-center gap-3 pl-12">
          <span className="text-primary text-sm font-bold">$</span>
          <Input
            value={token.ticker}
            onChange={(e) => setToken({ ...token, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 10) })}
            className="phantom-glass-input h-9 w-36 font-mono rounded-lg"
            placeholder="PEPE"
            maxLength={10}
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30 pl-1">Description</label>
        <Textarea
          value={token.description}
          onChange={(e) => setToken({ ...token, description: e.target.value })}
          placeholder="What's your token about?"
          className="phantom-glass-textarea rounded-xl min-h-[70px]"
          maxLength={500}
        />
        {token.description.length > 0 && (
          <p className="text-right text-[9px] text-white/20 font-mono pr-1">{token.description.length}/500</p>
        )}
      </div>

      {/* Social Links - always visible */}
      <div className="space-y-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30 pl-1">Social Links</label>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-white/20 flex-shrink-0" />
            <Input
              placeholder="https://yourwebsite.com"
              value={token.websiteUrl || ""}
              onChange={(e) => setToken({ ...token, websiteUrl: e.target.value })}
              className="phantom-glass-input text-sm rounded-lg h-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Twitter className="h-4 w-4 text-white/20 flex-shrink-0" />
            <Input
              placeholder="https://x.com/yourtoken"
              value={token.twitterUrl || ""}
              onChange={(e) => setToken({ ...token, twitterUrl: e.target.value })}
              className="phantom-glass-input text-sm rounded-lg h-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-white/20 flex-shrink-0" />
            <Input
              placeholder="https://t.me/yourgroup"
              value={token.telegramUrl || ""}
              onChange={(e) => setToken({ ...token, telegramUrl: e.target.value })}
              className="phantom-glass-input text-sm rounded-lg h-9"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
