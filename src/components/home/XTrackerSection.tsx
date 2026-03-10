import { useMemo } from "react";
import { KolTweetCard } from "@/components/x-tracker/KolTweetCard";
import { useKolTweets } from "@/hooks/useKolTweets";

export default function XTrackerSection() {
  const { data: kolTweets } = useKolTweets("all");
  const limitedTweets = useMemo(() => (kolTweets || []).slice(0, 6), [kolTweets]);

  if (!limitedTweets.length) {
    return <div className="text-center py-10 text-sm text-muted-foreground">No KOL tweets yet.</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {limitedTweets.map((t) => (
        <KolTweetCard key={t.id} tweet={t} />
      ))}
    </div>
  );
}
