import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTrackReferral } from "@/hooks/useReferral";

/**
 * Domain-based routing component
 * Redirects specific subdomains to their corresponding pages
 */
export function DomainRouter() {
  const location = useLocation();
  const navigate = useNavigate();

  // Track referrals from /link/:code URLs
  useTrackReferral();

  useEffect(() => {
    const hostname = window.location.hostname;

    // os.saturn.trade → /sdk
    if (hostname === "os.saturn.trade" && location.pathname === "/") {
      navigate("/sdk", { replace: true });
    }

    // punchlaunch.fun → show punch page at root
    const isPunchDomain = hostname === "punchlaunch.fun" || hostname === "www.punchlaunch.fun";
    if (isPunchDomain) {
      const allowed = ["/", "/trade/"];
      const isAllowed = allowed.some(p => location.pathname === p || (p.endsWith("/") && location.pathname.startsWith(p)));
      if (!isAllowed) {
        navigate("/", { replace: true });
      }
    }
  }, [location.pathname, navigate]);

  return null;
}
