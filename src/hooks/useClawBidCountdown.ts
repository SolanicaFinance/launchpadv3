import { useState, useEffect, useCallback } from "react";

export function useSaturnBidCountdown(biddingEndsAt: string | null | undefined) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isExpired, setIsExpired] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const calculateTimeLeft = useCallback(() => {
    if (!biddingEndsAt) {
      setTimeLeft("");
      setIsExpired(true);
      return;
    }

    const now = Date.now();
    const end = new Date(biddingEndsAt).getTime();
    const diff = end - now;

    if (diff <= 0) {
      setTimeLeft("Ended");
      setIsExpired(true);
      setSecondsLeft(0);
      return;
    }

    setIsExpired(false);
    setSecondsLeft(Math.floor(diff / 1000));

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (hours > 0) {
      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    } else if (minutes > 0) {
      setTimeLeft(`${minutes}m ${seconds}s`);
    } else {
      setTimeLeft(`${seconds}s`);
    }
  }, [biddingEndsAt]);

  useEffect(() => {
    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [calculateTimeLeft]);

  return { timeLeft, isExpired, secondsLeft };
}
