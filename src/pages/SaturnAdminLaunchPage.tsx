import { useState } from "react";

import { SaturnAdminLaunchPanel } from "@/components/saturn/SaturnAdminLaunchPanel";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { BRAND } from "@/config/branding";

export default function MoonDexoAdminLaunchPage() {
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  if (!authorized) {
    return (
      <div className="saturn-theme min-h-screen flex items-center justify-center" style={{ background: "hsl(var(--saturn-bg))" }}>
        <div className="p-6 rounded-xl max-w-sm w-full" style={{ background: "hsl(var(--saturn-surface))", border: "1px solid hsl(var(--saturn-border))" }}>
          <h2 className="text-lg font-black mb-4 text-center" style={{ color: "hsl(var(--saturn-primary))" }}>🌙 Admin Access</h2>
          <input
            type="password"
            placeholder="Enter admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && password.toLowerCase() === "claw") setAuthorized(true);
            }}
            className="w-full px-3 py-2 rounded-lg text-sm mb-3"
            style={{ background: "hsl(var(--saturn-bg))", border: "1px solid hsl(var(--saturn-border))", color: "hsl(var(--saturn-text))" }}
          />
          <button
            onClick={() => { if (password.toLowerCase() === "claw") setAuthorized(true); }}
            className="w-full py-2 rounded-lg text-sm font-bold"
            style={{ background: "linear-gradient(135deg, hsl(var(--saturn-primary)), hsl(var(--saturn-accent)))", color: "hsl(var(--saturn-bg))" }}
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="saturn-theme min-h-screen p-6" style={{ background: "hsl(var(--saturn-bg))" }}>
      <div className="max-w-lg mx-auto">
        <button
          onClick={() => navigate("/claw")}
          className="flex items-center gap-2 text-sm mb-6 hover:opacity-80"
          style={{ color: "hsl(var(--saturn-muted))" }}
        >
          <ArrowLeft className="h-4 w-4" /> Back to {BRAND.name}
        </button>
        <SaturnAdminLaunchPanel />
      </div>
    </div>
  );
}
