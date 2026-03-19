import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const PENDING_NAV_KEY = "claw_pending_panel_nav";

export function usePanelNav(defaultPath = "/panel") {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      const pending = sessionStorage.getItem(PENDING_NAV_KEY);
      if (pending) {
        sessionStorage.removeItem(PENDING_NAV_KEY);
        navigate(pending);
      }
    }
  }, [isAuthenticated, navigate]);

  const goToPanel = useCallback((pathOrEvent?: string | React.MouseEvent) => {
    const target = typeof pathOrEvent === "string" ? pathOrEvent : defaultPath;
    if (isAuthenticated) {
      navigate(target);
    } else {
      // Redirect to saturn-panel.com for unauthenticated users
      window.open("https://saturn-panel.com", "_blank");
    }
  }, [isAuthenticated, navigate, defaultPath]);

  return { goToPanel };
}
