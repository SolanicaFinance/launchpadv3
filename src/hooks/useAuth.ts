import { useMemo, useState, useEffect } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { usePrivyAvailable } from "@/providers/PrivyProviderWrapper";
import { privyUserIdToUuid } from "@/lib/privyUuid";

export interface AuthUser {
  id: string;
  privyId: string;
  displayName: string | null;
  avatarUrl: string | null;
  twitter?: {
    username?: string;
  };
  wallet?: {
    address?: string;
  };
}

export interface UseAuthReturn {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  solanaAddress: string | null;
  profileId: string | null;
  login: () => void;
  logout: () => Promise<void>;
}

const FALLBACK: UseAuthReturn = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  solanaAddress: null,
  profileId: null,
  login: () => console.warn("Privy not available - check PRIVY_APP_ID secret"),
  logout: async () => {},
};

export function useAuth(): UseAuthReturn {
  const privyAvailable = usePrivyAvailable();

  // Always call all hooks unconditionally
  const privy = usePrivy();
  const { wallets } = useWallets();
  const [profileId, setProfileId] = useState<string | null>(null);

  const user = privy?.user ?? null;
  const ready = privy?.ready ?? false;
  const authenticated = privy?.authenticated ?? false;

  useEffect(() => {
    if (!privyAvailable) return;
    if (user?.id) {
      privyUserIdToUuid(user.id).then(setProfileId);
    } else {
      setProfileId(null);
    }
  }, [user?.id, privyAvailable]);

  const solanaAddress = useMemo(() => {
    if (!privyAvailable) return null;
    if (user?.wallet?.address) return user.wallet.address;
    const solanaWallet = wallets?.find((w) => w.address?.length > 30);
    if (solanaWallet?.address) return solanaWallet.address;
    return null;
  }, [wallets, user?.wallet?.address, privyAvailable]);

  const authUser = useMemo<AuthUser | null>(() => {
    if (!privyAvailable || !user) return null;
    return {
      id: user.id,
      privyId: user.id,
      displayName:
        user.twitter?.username ||
        user.email?.address?.split("@")[0] ||
        solanaAddress?.slice(0, 8) ||
        "Anonymous",
      avatarUrl: user.twitter?.profilePictureUrl || null,
      twitter: user.twitter
        ? { username: user.twitter.username }
        : undefined,
      wallet: solanaAddress
        ? { address: solanaAddress }
        : undefined,
    };
  }, [user, solanaAddress, privyAvailable]);

  if (!privyAvailable) return FALLBACK;

  return {
    user: authUser,
    isAuthenticated: authenticated,
    isLoading: !ready,
    solanaAddress,
    profileId,
    login: privy.login,
    logout: privy.logout,
  };
}
