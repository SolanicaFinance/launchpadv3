import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Trash2, Check, X, ExternalLink, Image as ImageIcon } from "lucide-react";
import { ListingImageGenerator } from "./ListingImageGenerator";

interface ListedToken {
  id: string;
  mint_address: string;
  pool_address: string;
  token_name: string | null;
  token_ticker: string | null;
  image_url: string | null;
  max_leverage: number;
  is_active: boolean;
  liquidity_usd: number | null;
  market_cap: number | null;
  created_at: string;
}

interface ListedTokensTableProps {
  tokens: ListedToken[];
  onUpdate: (id: string, maxLeverage?: number, isActive?: boolean) => void;
  onRemove: (id: string) => void;
}

export function ListedTokensTable({ tokens, onUpdate, onRemove }: ListedTokensTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(1);
  const [imageGenId, setImageGenId] = useState<string | null>(null);

  if (!tokens.length) {
    return <p className="text-sm text-muted-foreground text-center py-8">No tokens listed yet.</p>;
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary/30">
            <TableHead className="w-10"></TableHead>
            <TableHead>Token</TableHead>
            <TableHead>CA</TableHead>
            <TableHead className="text-right">Leverage</TableHead>
            <TableHead className="text-right">Liquidity</TableHead>
            <TableHead className="text-center">Active</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tokens.map((t) => (
            <React.Fragment key={t.id}>
            <TableRow className={!t.is_active ? "opacity-50" : ""}>
              <TableCell>
                {t.image_url ? (
                  <img src={t.image_url} className="w-7 h-7 rounded-full object-cover" alt="" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-secondary" />
                )}
              </TableCell>
              <TableCell>
                <span className="font-medium text-foreground">{t.token_name || "—"}</span>
                {t.token_ticker && (
                  <span className="text-muted-foreground text-xs ml-1">${t.token_ticker}</span>
                )}
              </TableCell>
              <TableCell>
                <a
                  href={`https://solscan.io/token/${t.mint_address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                >
                  {t.mint_address.slice(0, 6)}...{t.mint_address.slice(-4)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </TableCell>
              <TableCell className="text-right">
                {editingId === t.id ? (
                  <div className="flex items-center gap-1 justify-end">
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={editValue}
                      onChange={(e) => setEditValue(Number(e.target.value))}
                      className="w-16 h-7 text-xs font-mono"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => { onUpdate(t.id, editValue); setEditingId(null); }}
                    >
                      <Check className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <button
                    className="font-mono text-sm font-bold text-primary hover:underline"
                    onClick={() => { setEditingId(t.id); setEditValue(t.max_leverage); }}
                  >
                    {t.max_leverage}x
                  </button>
                )}
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">
                {t.liquidity_usd ? `$${(t.liquidity_usd / 1000).toFixed(1)}k` : "—"}
              </TableCell>
              <TableCell className="text-center">
                <button
                  onClick={() => onUpdate(t.id, undefined, !t.is_active)}
                  className={`w-8 h-5 rounded-full transition-colors ${t.is_active ? "bg-green-500" : "bg-secondary"}`}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${t.is_active ? "translate-x-3.5" : "translate-x-0.5"}`}
                  />
                </button>
              </TableCell>
              <TableCell className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                  onClick={() => setImageGenId(imageGenId === t.id ? null : t.id)}
                  title="Generate listing image"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onRemove(t.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </TableCell>
            </TableRow>
            {imageGenId === t.id && t.image_url && t.token_ticker && (
              <TableRow>
                <TableCell colSpan={7} className="p-4">
                  <ListingImageGenerator
                    tokenImageUrl={t.image_url}
                    ticker={t.token_ticker}
                    tokenName={t.token_name || undefined}
                  />
                </TableCell>
              </TableRow>
            )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
