import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTrackReferral } from "@/hooks/useReferral";
import { BRAND } from "@/config/branding";

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

    // os.${BRAND.domain} → /sdk
    if (hostname === `os.${BRAND.domain}` && location.pathname === "/") {
      navigate("/sdk", { replace: true });
    }

  }, [location.pathname, navigate]);

  return null;
}
