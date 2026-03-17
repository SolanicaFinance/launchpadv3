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

// Real auth using Privy — ONLY safe to call inside PrivyProvider
function useAuthPrivy(): UseAuthReturn {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const [profileId, setProfileId] = useState<string | null>(null);

  // Convert Privy DID to deterministic UUID (must match server-side sync-privy-user)
  useEffect(() => {
    if (user?.id) {
      privyUserIdToUuid(user.id).then(setProfileId);
    } else {
      setProfileId(null);
    }
  }, [user?.id]);

  const solanaAddress = useMemo(() => {
    if (user?.wallet?.address) return user.wallet.address;
    const solanaWallet = wallets?.find((w) => w.address?.length > 30);
    if (solanaWallet?.address) return solanaWallet.address;
    return null;
  }, [wallets, user?.wallet?.address]);

  const authUser = useMemo<AuthUser | null>(() => {
    if (!user) return null;
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
  }, [user, solanaAddress]);

  return {
    user: authUser,
    isAuthenticated: authenticated,
    isLoading: !ready,
    solanaAddress,
    profileId,
    login,
    logout,
  };
}

// Main hook that switches between implementations
export function useAuth(): UseAuthReturn {
  const privyAvailable = usePrivyAvailable();

  if (!privyAvailable) {
    return FALLBACK;
  }

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useAuthPrivy();
  } catch (error) {
    console.warn("[useAuth] Privy not ready yet, returning fallback.", error);
    return FALLBACK;
  }
}
