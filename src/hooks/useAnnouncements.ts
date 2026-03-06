import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";

interface Announcement {
  id: string;
  title: string;
  description: string | null;
  action_label: string | null;
  action_url: string | null;
  emoji: string | null;
}

function getSeenIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem("seen-announcements") || "[]");
  } catch {
    return [];
  }
}

function markSeen(id: string) {
  const seen = getSeenIds();
  if (!seen.includes(id)) {
    seen.push(id);
    localStorage.setItem("seen-announcements", JSON.stringify(seen));
  }
}

function getDisabledPages(): string[] {
  try {
    return JSON.parse(localStorage.getItem("announcement-disabled-pages") || "[]");
  } catch {
    return [];
  }
}

export function useAnnouncements() {
  const navigate = useNavigate();
  const location = useLocation();

  const { data: announcements } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, description, action_label, action_url, emoji")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as Announcement[];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!announcements?.length) return;

    // Check if current page is disabled
    const disabledPages = getDisabledPages();
    if (disabledPages.includes(location.pathname)) return;

    const seen = getSeenIds();
    const unseen = announcements.filter((a) => !seen.includes(a.id));

    unseen.forEach((a, i) => {
      setTimeout(() => {
        const toastTitle = `${a.emoji || "📢"} ${a.title}`;
        toast(toastTitle, {
          description: a.description || undefined,
          action: a.action_label && a.action_url
            ? {
                label: a.action_label,
                onClick: () => {
                  if (a.action_url!.startsWith("http")) {
                    window.open(a.action_url!, "_blank");
                  } else {
                    navigate(a.action_url!);
                  }
                },
              }
            : undefined,
          duration: 8000,
        });
        markSeen(a.id);
      }, 1500 + i * 2000);
    });
  }, [announcements, navigate, location.pathname]);
}
