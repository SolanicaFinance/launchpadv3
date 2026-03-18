import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  lazy,
  Suspense,
} from "react";
import saturnLogo from "@/assets/saturn-logo.png";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { BRAND } from "@/config/branding";

/* ------------------------------------------------------------------ */
/*  Bridge: safely exposes Privy hook results via React context        */
/*  so consumer hooks NEVER call Privy hooks directly.                 */
/* ------------------------------------------------------------------ */

export interface PrivyBridgeData {
  privy: {
    ready: boolean;
    authenticated: boolean;
    user: any;
    login: () => void;
    logout: () => Promise<void>;
    linkTwitter: () => Promise<void>;
    linkEmail: () => Promise<void>;
  };
  evmWallets: any[];
  evmCreateWallet: any;
  solanaWallets: any[];
  solanaWalletsReady: boolean;
  solanaCreateWallet: any;
  solanaSignAndSend: any;
  solanaSign: any;
  delegateWallet: (params: { address: string; chainType: "solana" | "ethereum" }) => Promise<void>;
}

const noopAsync = async () => {};
const noopLogin = () => {};

const DEFAULT_BRIDGE: PrivyBridgeData = {
  privy: {
    ready: false,
    authenticated: false,
    user: null,
    login: noopLogin,
    logout: noopAsync,
    linkTwitter: noopAsync,
    linkEmail: noopAsync,
  },
  evmWallets: [],
  evmCreateWallet: { createWallet: async () => { throw new Error("Privy not ready"); } },
  solanaWallets: [],
  solanaWalletsReady: false,
  solanaCreateWallet: { createWallet: async () => { throw new Error("Privy not ready"); } },
  solanaSignAndSend: { signAndSendTransaction: async () => { throw new Error("Privy not ready"); } },
  solanaSign: { signTransaction: async () => { throw new Error("Privy not ready"); } },
  delegateWallet: async () => { throw new Error("Privy not ready"); },
};

const PrivyBridgeContext = createContext<PrivyBridgeData>(DEFAULT_BRIDGE);
const PrivyAvailableContext = createContext(false);

export function usePrivyAvailable() {
  return useContext(PrivyAvailableContext);
}

export function usePrivyBridge(): PrivyBridgeData {
  return useContext(PrivyBridgeContext);
}

/* ------------------------------------------------------------------ */
/*  Lazy-loaded Privy provider + bridge populator                      */
/* ------------------------------------------------------------------ */

const PrivyProviderWithGate = lazy(async () => {
  const mod = await import("@privy-io/react-auth");
  const solanaMod = await import("@privy-io/react-auth/solana");

  /**
   * Only mounted when usePrivy().ready === true.
   * Calls all Privy hooks that are unsafe to call before ready,
   * and pushes results into parent state via onData.
   */
  function WalletBridgePopulator({ onData }: { onData: (d: Omit<PrivyBridgeData, "privy">) => void }) {
    const evmResult = mod.useWallets();
    const evmCreate = mod.useCreateWallet();
    const solResult = solanaMod.useWallets();
    const solCreate = solanaMod.useCreateWallet();
    const solSign = solanaMod.useSignAndSendTransaction();
    const solSignOnly = solanaMod.useSignTransaction();
    const { delegateWallet } = mod.useHeadlessDelegatedActions();

    // Stable identity keys to avoid infinite effect loops
    const evmKey = (evmResult.wallets ?? []).map((w: any) => w.address).join(",");
    const solKey = (solResult.wallets ?? []).map((w: any) => w.address).join(",");
    const solReady = solResult.ready;

    useEffect(() => {
      onData({
        evmWallets: evmResult.wallets ?? [],
        evmCreateWallet: evmCreate,
        solanaWallets: solResult.wallets ?? [],
        solanaWalletsReady: solReady ?? false,
        solanaCreateWallet: solCreate,
        solanaSignAndSend: solSign,
        solanaSign: solSignOnly,
        delegateWallet,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [evmKey, solKey, solReady, onData]);

    return null;
  }

  function InnerReadyGate({ children }: { children: ReactNode }) {
    const privyResult = mod.usePrivy();
    const ready = privyResult.ready;

    const [walletData, setWalletData] = useState<Omit<PrivyBridgeData, "privy">>({
      evmWallets: [],
      evmCreateWallet: DEFAULT_BRIDGE.evmCreateWallet,
      solanaWallets: [],
      solanaWalletsReady: false,
      solanaCreateWallet: DEFAULT_BRIDGE.solanaCreateWallet,
      solanaSignAndSend: DEFAULT_BRIDGE.solanaSignAndSend,
      solanaSign: DEFAULT_BRIDGE.solanaSign,
    });

    const bridgeValue = useMemo<PrivyBridgeData>(() => ({
      privy: {
        ready: privyResult.ready,
        authenticated: privyResult.authenticated,
        user: privyResult.user,
        login: privyResult.login,
        logout: privyResult.logout,
        linkTwitter: (privyResult as any).linkTwitter ?? noopAsync,
        linkEmail: (privyResult as any).linkEmail ?? noopAsync,
      },
      ...walletData,
    }), [
      privyResult.ready,
      privyResult.authenticated,
      privyResult.user,
      privyResult.login,
      privyResult.logout,
      (privyResult as any).linkTwitter,
      (privyResult as any).linkEmail,
      walletData,
    ]);

    return (
      <PrivyAvailableContext.Provider value={ready}>
        <PrivyBridgeContext.Provider value={bridgeValue}>
          {ready && <WalletBridgePopulator onData={setWalletData} />}
          {children}
        </PrivyBridgeContext.Provider>
      </PrivyAvailableContext.Provider>
    );
  }

  function WrappedProvider({ children, ...props }: any) {
    return (
      <mod.PrivyProvider {...props}>
        <InnerReadyGate>{children}</InnerReadyGate>
      </mod.PrivyProvider>
    );
  }

  return { default: WrappedProvider };
});

/* ------------------------------------------------------------------ */
/*  Public wrapper                                                     */
/* ------------------------------------------------------------------ */

interface PrivyProviderWrapperProps {
  children: ReactNode;
}

function isValidPrivyAppId(appId: string) {
  return appId.length > 0 && !appId.includes("${");
}

function getHeliusRpcUrlFromRuntime(): string | null {
  const isValidHttpsUrl = (value?: string | null) =>
    !!value && value.startsWith("https://") && !value.includes("${");

  const isBrowser = typeof window !== "undefined";

  if (isBrowser) {
    const fromWindow = (window as any)?.__PUBLIC_CONFIG__?.heliusRpcUrl as string | undefined;
    if (isValidHttpsUrl(fromWindow)) return fromWindow!.trim();

    const runtimeLoaded = !!(window as any)?.__PUBLIC_CONFIG_LOADED__;
    if (!runtimeLoaded) {
      const fromStorage = localStorage.getItem("heliusRpcUrl");
      if (isValidHttpsUrl(fromStorage)) return fromStorage!.trim();
      return "https://mainnet.helius-rpc.com";
    }

    const fromStorage = localStorage.getItem("heliusRpcUrl");
    if (isValidHttpsUrl(fromStorage)) return fromStorage!.trim();
  }

  const fromEnv = import.meta.env.VITE_HELIUS_RPC_URL;
  if (isValidHttpsUrl(fromEnv)) return fromEnv!.trim();

  const apiKey = import.meta.env.VITE_HELIUS_API_KEY;
  if (apiKey && typeof apiKey === "string" && apiKey.trim().length > 10 && !apiKey.includes("${")) {
    return `https://mainnet.helius-rpc.com/?api-key=${apiKey.trim()}`;
  }

  return "https://mainnet.helius-rpc.com";
}

function toWebsocketUrl(httpUrl: string): string {
  return httpUrl.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:");
}

export function PrivyProviderWrapper({ children }: PrivyProviderWrapperProps) {
  const rawAppId = import.meta.env.VITE_PRIVY_APP_ID;
  const buildTimeAppId = (rawAppId ?? "").trim();

  const [resolvedAppId, setResolvedAppId] = useState<string>(() => {
    if (isValidPrivyAppId(buildTimeAppId)) return buildTimeAppId;
    const fromWindow = ((window as any)?.__PUBLIC_CONFIG__?.privyAppId as string | undefined) ?? "";
    if (isValidPrivyAppId(fromWindow.trim())) return fromWindow.trim();
    return "";
  });

  useEffect(() => {
    if (isValidPrivyAppId(buildTimeAppId)) {
      if (!isValidPrivyAppId(resolvedAppId)) setResolvedAppId(buildTimeAppId);
      return;
    }
    if (isValidPrivyAppId(resolvedAppId)) return;

    let cancelled = false;
    const startedAt = Date.now();
    const maxWaitMs = 15000;

    const timer = window.setInterval(() => {
      if (cancelled) return;
      const fromWindow = ((window as any)?.__PUBLIC_CONFIG__?.privyAppId as string | undefined) ?? "";
      const candidate = fromWindow.trim();
      if (isValidPrivyAppId(candidate)) {
        setResolvedAppId(candidate);
        window.clearInterval(timer);
        return;
      }
      if (Date.now() - startedAt > maxWaitMs) {
        window.clearInterval(timer);
      }
    }, 400);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [buildTimeAppId, resolvedAppId]);

  const appId = resolvedAppId;
  const privyAvailable = isValidPrivyAppId(appId);

  const solanaConnectors = useMemo(
    () => toSolanaWalletConnectors({ shouldAutoConnect: false }),
    []
  );

  const solanaHttpRpcUrl = getHeliusRpcUrlFromRuntime() ?? "https://api.mainnet-beta.solana.com";
  const solanaWsUrl = toWebsocketUrl(solanaHttpRpcUrl);

  if (!privyAvailable) {
    return (
      <PrivyAvailableContext.Provider value={false}>
        <PrivyBridgeContext.Provider value={DEFAULT_BRIDGE}>
          {children}
        </PrivyBridgeContext.Provider>
      </PrivyAvailableContext.Provider>
    );
  }

  return (
    <Suspense
      fallback={
        <PrivyAvailableContext.Provider value={false}>
          <PrivyBridgeContext.Provider value={DEFAULT_BRIDGE}>
            {children}
          </PrivyBridgeContext.Provider>
        </PrivyAvailableContext.Provider>
      }
    >
      <PrivyProviderWithGate
        appId={appId}
        config={{
          loginMethods: ["wallet", "twitter", "email"],
          externalWallets: {
            solana: {
              connectors: solanaConnectors,
            },
          },
          solana: {
            rpcs: {
              "solana:mainnet": {
                rpc: createSolanaRpc(solanaHttpRpcUrl),
                rpcSubscriptions: createSolanaRpcSubscriptions(solanaWsUrl),
                blockExplorerUrl: "https://solscan.io",
              },
            },
          },
          supportedChains: [
            {
              id: 56,
              name: "BNB Smart Chain",
              nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
              rpcUrls: {
                default: { http: [`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || 'ptwytypavumcrbofspno'}.supabase.co/functions/v1/bsc-rpc`] },
              },
              blockExplorers: {
                default: { name: "BscScan", url: "https://bscscan.com" },
              },
            } as any,
          ],
          defaultChain: {
            id: 56,
            name: "BNB Smart Chain",
            nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
            rpcUrls: {
              default: { http: [`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || 'ptwytypavumcrbofspno'}.supabase.co/functions/v1/bsc-rpc`] },
            },
            blockExplorers: {
              default: { name: "BscScan", url: "https://bscscan.com" },
            },
          } as any,
          appearance: {
            theme: "dark",
            accentColor: "#22c55e",
            logo: saturnLogo,
            showWalletLoginFirst: true,
            walletChainType: "ethereum-and-solana",
            walletList: ["metamask", "phantom", "solflare", "backpack", "detected_wallets"],
          },
          embeddedWallets: {
            solana: {
              createOnLogin: "all-users",
            },
            ethereum: {
              createOnLogin: "all-users",
            },
          },
          legal: {
            termsAndConditionsUrl: "/terms",
            privacyPolicyUrl: "/privacy",
          },
        }}
      >
        {children}
      </PrivyProviderWithGate>
    </Suspense>
  );
}
