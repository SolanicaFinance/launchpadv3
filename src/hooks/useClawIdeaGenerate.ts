import { useState, useCallback } from "react";

interface ClawIdea {
  name: string;
  ticker: string;
  description: string;
  imageUrl: string;
  tweetText: string;
  theme: string;
}

export function useSaturnIdeaGenerate() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [idea, setIdea] = useState<ClawIdea | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (prompt?: string) => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claw-idea-generate`,
        {
          method: "POST",
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prompt }),
        }
      );

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Generation failed");
      }

      const meme = data.meme;
      setIdea(meme);
      return meme;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const reset = useCallback(() => {
    setIdea(null);
    setError(null);
  }, []);

  return { generate, isGenerating, idea, error, reset };
}
