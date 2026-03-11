import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  lazy,
  Suspense,
} from "react";
import saturnLogo from "@/assets/saturn-logo.png";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { BRAND } from "@/config/branding";

// Lazy load Privy - it's a heavy dependency
const PrivyProvider = lazy(() =>
  import("@privy-io/react-auth").then((mod) => ({ default: mod.PrivyProvider }))
);

// Context to track if Privy is available
const PrivyAvailableContext = createContext(false);

export function usePrivyAvailable() {
  return useContext(PrivyAvailableContext);
}

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

  // 1) runtime config on window (freshest)
  if (isBrowser) {
    const fromWindow = (window as any)?.__PUBLIC_CONFIG__?.heliusRpcUrl as string | undefined;
    if (isValidHttpsUrl(fromWindow)) {
      return fromWindow!.trim();
    }

    // Avoid stale baked env keys before runtime config finishes loading.
    const runtimeLoaded = !!(window as any)?.__PUBLIC_CONFIG_LOADED__;
    if (!runtimeLoaded) {
      const fromStorage = localStorage.getItem("heliusRpcUrl");
      if (isValidHttpsUrl(fromStorage)) return fromStorage!.trim();
      return "https://mainnet.helius-rpc.com";
    }

    // runtime loaded but window config missing: try persisted URL
    const fromStorage = localStorage.getItem("heliusRpcUrl");
    if (isValidHttpsUrl(fromStorage)) {
      return fromStorage!.trim();
    }
  }

  // 2) build-time env (last resort)
  const fromEnv = import.meta.env.VITE_HELIUS_RPC_URL;
  if (isValidHttpsUrl(fromEnv)) {
    return fromEnv!.trim();
  }

  // 3) api key -> construct paid Helius URL (last resort)
  const apiKey = import.meta.env.VITE_HELIUS_API_KEY;
  if (apiKey && typeof apiKey === "string" && apiKey.trim().length > 10 && !apiKey.includes("${")) {
    return `https://mainnet.helius-rpc.com/?api-key=${apiKey.trim()}`;
  }

  // 4) fallback
  return "https://mainnet.helius-rpc.com";
}

function toWebsocketUrl(httpUrl: string): string {
  return httpUrl.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:");
}

export function PrivyProviderWrapper({ children }: PrivyProviderWrapperProps) {
  const rawAppId = import.meta.env.VITE_PRIVY_APP_ID;
  const buildTimeAppId = (rawAppId ?? "").trim();

  // Prefer build-time env, otherwise use the runtime config loaded by RuntimeConfigBootstrap.
  // IMPORTANT: We avoid doing our own public-config fetch here because aggressive retries +
  // AbortController timeouts can create an abort loop that interrupts other data loading.
  const [resolvedAppId, setResolvedAppId] = useState<string>(() => {
    if (isValidPrivyAppId(buildTimeAppId)) return buildTimeAppId;
    const fromWindow = ((window as any)?.__PUBLIC_CONFIG__?.privyAppId as string | undefined) ?? "";
    if (isValidPrivyAppId(fromWindow.trim())) return fromWindow.trim();
    return "";
  });

  // If we didn't have a valid app id at build time, wait briefly for RuntimeConfigBootstrap
  // to populate window.__PUBLIC_CONFIG__, then hydrate the app id once available.
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
        // Give up quietly — app should still load without Privy.
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

  // Privy embedded Solana wallets require Solana RPC config.
  // Use Helius when available; otherwise fall back to the public Solana endpoint.
  const solanaHttpRpcUrl = getHeliusRpcUrlFromRuntime() ?? "https://api.mainnet-beta.solana.com";
  const solanaWsUrl = toWebsocketUrl(solanaHttpRpcUrl);

  if (!privyAvailable) {
    return (
      <PrivyAvailableContext.Provider value={false}>
        {children}
      </PrivyAvailableContext.Provider>
    );
  }

  return (
    <Suspense
      fallback={
        <PrivyAvailableContext.Provider value={false}>
          {children}
        </PrivyAvailableContext.Provider>
      }
    >
      <PrivyAvailableContext.Provider value={true}>
        <PrivyProvider
          appId={appId}
          config={{
            loginMethods: ["wallet", "twitter", "email"],
            externalWallets: {
              solana: {
                connectors: solanaConnectors,
              },
            },
            // Required for Privy's embedded wallet transaction UIs.
            solana: {
              rpcs: {
                "solana:mainnet": {
                  rpc: createSolanaRpc(solanaHttpRpcUrl),
                  rpcSubscriptions: createSolanaRpcSubscriptions(solanaWsUrl),
                  blockExplorerUrl: "https://solscan.io",
                },
              },
            },
            appearance: {
              theme: "dark",
              accentColor: "#22c55e", // RIFT green
              logo: saturnLogo,
              showWalletLoginFirst: true,
              walletChainType: "solana-only",
              walletList: ["phantom", "solflare", "backpack", "detected_wallets"],
            },
            embeddedWallets: {
              solana: {
                createOnLogin: "all-users",
              },
              ethereum: {
                createOnLogin: "off",
              },
            },
            legal: {
              termsAndConditionsUrl: "/terms",
              privacyPolicyUrl: "/privacy",
            },
          }}
        >
          {children}
        </PrivyProvider>
      </PrivyAvailableContext.Provider>
    </Suspense>
  );
}
