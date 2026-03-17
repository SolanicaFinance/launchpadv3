import { useMemo, useState, useEffect } from "react";
import { usePrivyAvailable, usePrivyBridge } from "@/providers/PrivyProviderWrapper";
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
  const bridge = usePrivyBridge();
  const [profileId, setProfileId] = useState<string | null>(null);

  const { privy, evmWallets } = bridge;
  const user = privy.user;

  useEffect(() => {
    if (!privyAvailable || !user?.id) {
      setProfileId(null);
      return;
    }
    privyUserIdToUuid(user.id).then(setProfileId);
  }, [user?.id, privyAvailable]);

  const solanaAddress = useMemo(() => {
    if (!privyAvailable) return null;
    if (user?.wallet?.address) return user.wallet.address;
    const solanaWallet = evmWallets?.find((w: any) => w.address?.length > 30);
    if (solanaWallet?.address) return solanaWallet.address;
    return null;
  }, [evmWallets, user?.wallet?.address, privyAvailable]);

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
    isAuthenticated: privy.authenticated,
    isLoading: !privy.ready,
    solanaAddress,
    profileId,
    login: privy.login,
    logout: privy.logout,
  };
}
