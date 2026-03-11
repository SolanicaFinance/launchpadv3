import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UseSubTunaRealtimeOptions {
  subtunaId?: string;
  postId?: string;
  enabled?: boolean;
}

// Debounce interval for batch invalidations (5 seconds)
const DEBOUNCE_MS = 5000;

/**
 * Hook for realtime updates on SubTuna posts and comments.
 * Automatically invalidates queries when changes are detected.
 * 
 * Phase C optimization:
 * - Debounces invalidations to prevent refetch storms
 * - Disables vote subscriptions on global feed
 * - Only enables full realtime on specific community/post pages
 */
export function useSaturnRealtime({
  subtunaId,
  postId,
  enabled = true,
}: UseSubTunaRealtimeOptions = {}) {
  const queryClient = useQueryClient();
  const pendingInvalidation = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInvalidation = useRef<number>(0);

  // Debounced invalidation to batch multiple events
  const debouncedInvalidate = useCallback((queryKey: string[]) => {
    const now = Date.now();
    
    // If we just invalidated, skip
    if (now - lastInvalidation.current < DEBOUNCE_MS) {
      return;
    }

    // Clear any pending invalidation
    if (pendingInvalidation.current) {
      clearTimeout(pendingInvalidation.current);
    }

    // Schedule batched invalidation
    pendingInvalidation.current = setTimeout(() => {
      lastInvalidation.current = Date.now();
      queryClient.invalidateQueries({ queryKey });
      pendingInvalidation.current = null;
    }, 500); // Small delay to batch rapid events
  }, [queryClient]);

  useEffect(() => {
    // Phase C: Disable realtime on global feed entirely to reduce load
    const isGlobalFeed = !subtunaId && !postId;
    if (!enabled || isGlobalFeed) {
      return;
    }

    const channelName = `forum-realtime-${subtunaId || postId || "global"}`;
    const channel = supabase.channel(channelName);

    // Subscribe to post changes only for specific subtuna
    if (subtunaId) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subtuna_posts",
          filter: `subtuna_id=eq.${subtunaId}`,
        },
        (payload) => {
          console.log("[Saturn Forum Realtime] Post change:", payload.eventType);
          debouncedInvalidate(["subtuna-posts"]);
        }
      );
    }

    // Subscribe to comment changes if viewing a specific post
    if (postId) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subtuna_comments",
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          console.log("[Saturn Forum Realtime] Comment change:", payload.eventType);
          debouncedInvalidate(["subtuna-comments", postId]);
          debouncedInvalidate(["subtuna-post", postId]);
        }
      );

      // Only subscribe to votes on specific post pages (not community pages)
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subtuna_votes",
          filter: `post_id=eq.${postId}`,
        },
        () => {
          debouncedInvalidate(["subtuna-posts"]);
        }
      );
    }

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("[Saturn Forum Realtime] Connected to", channelName);
      }
    });

    return () => {
      if (pendingInvalidation.current) {
        clearTimeout(pendingInvalidation.current);
      }
      channel.unsubscribe();
    };
  }, [subtunaId, postId, enabled, queryClient, debouncedInvalidate]);
}
