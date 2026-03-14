import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, ExternalLink, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface KolAccount {
  id: string;
  username: string;
  display_name: string | null;
  profile_image_url: string | null;
  cached_avatar_url: string | null;
  follower_count: number;
  is_active: boolean;
  source: string;
  created_at: string;
  added_at: string | null;
}

const PAGE_SIZE = 20;

export function RecentlyAddedKols() {
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["community-kols", page],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from("kol_accounts")
        .select("id, username, display_name, profile_image_url, cached_avatar_url, follower_count, is_active, source, created_at, added_at", { count: "exact" })
        .eq("source", "community")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { kols: (data as unknown as KolAccount[]) || [], total: count || 0 };
    },
    staleTime: 30_000,
  });

  const kols = data?.kols || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-card border border-border animate-pulse" />
        ))}
      </div>
    );
  }

  if (!kols.length) {
    return (
      <div className="text-center py-16">
        <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
        <p className="text-sm text-muted-foreground">No community-added KOLs yet.</p>
        <p className="text-xs text-muted-foreground mt-1">Use the "Add KOL" button to submit accounts with 50k+ followers.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {kols.map((kol) => (
          <div
            key={kol.id}
            className="flex items-center gap-3 p-3 rounded-xl bg-card/30 border border-border/20 hover:border-primary/30 hover:bg-card/50 transition-all"
          >
            {(kol.cached_avatar_url || kol.profile_image_url) ? (
              <img
                src={kol.cached_avatar_url || kol.profile_image_url || ""}
                alt={kol.username}
                className="w-10 h-10 rounded-full object-cover border border-border/30 flex-shrink-0"
                loading="lazy"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center text-sm font-bold text-muted-foreground flex-shrink-0">
                {kol.username[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <a
                href={`https://x.com/${kol.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-foreground hover:text-primary truncate block transition-colors"
              >
                @{kol.username}
              </a>
              {kol.display_name && (
                <div className="text-xs text-muted-foreground truncate">{kol.display_name}</div>
              )}
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-muted-foreground">
                  {(kol.follower_count || 0).toLocaleString()} followers
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  kol.is_active 
                    ? "bg-green-500/10 text-green-400" 
                    : "bg-red-500/10 text-red-400"
                }`}>
                  {kol.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
            <a
              href={`https://x.com/${kol.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md hover:bg-secondary transition-colors flex-shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </a>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
