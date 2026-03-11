import { useState, useCallback } from "react";

export function useSaturnAdminLaunch() {
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const launch = useCallback(async (params: {
    name: string;
    ticker: string;
    description: string;
    avatarUrl?: string;
    strategy?: string;
    creatorWallet?: string;
    twitterUrl?: string;
  }) => {
    setIsLaunching(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claw-trading-create`,
        {
          method: "POST",
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(params),
        }
      );

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Launch failed");
      }
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      throw err;
    } finally {
      setIsLaunching(false);
    }
  }, []);

  return { launch, isLaunching, error };
}
