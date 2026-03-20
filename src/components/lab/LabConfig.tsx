import { Settings, Server, Wallet, Shield } from "lucide-react";

export function LabConfig() {
  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="p-4 rounded-lg border border-border bg-card space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Settings className="h-4 w-4 text-primary" />
          Lab Configuration
        </h3>

        <ConfigRow
          icon={Server}
          label="Environment"
          value="Devnet (Lab)"
          desc="Lab uses simulated reserves — no on-chain transactions"
        />
        <ConfigRow
          icon={Wallet}
          label="Program ID"
          value="Not deployed yet"
          desc="Deploy the Anchor program and paste the ID here"
        />
        <ConfigRow
          icon={Shield}
          label="Test Threshold"
          value="1 SOL"
          desc="Default graduation threshold for testing"
        />
        <ConfigRow
          icon={Shield}
          label="Production Threshold"
          value="85 SOL"
          desc="Real graduation threshold for mainnet"
        />
      </div>

      <div className="p-4 rounded-lg border border-border bg-card space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Deployment Status</h4>
        <div className="space-y-2 text-xs">
          <StatusRow label="Anchor Program" status="pending" />
          <StatusRow label="Devnet Deploy" status="pending" />
          <StatusRow label="Config Initialized" status="pending" />
          <StatusRow label="Edge Functions" status="active" />
          <StatusRow label="Lab Database" status="active" />
          <StatusRow label="Mainnet Deploy" status="pending" />
        </div>
      </div>

      <div className="p-4 rounded-lg border border-border bg-card space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Token Economics</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <span className="text-muted-foreground">Total Supply</span>
          <span className="font-mono text-foreground">1,000,000,000</span>
          <span className="text-muted-foreground">Curve Allocation</span>
          <span className="font-mono text-foreground">80% (800M)</span>
          <span className="text-muted-foreground">LP Reserve</span>
          <span className="font-mono text-foreground">20% (200M)</span>
          <span className="text-muted-foreground">Virtual SOL</span>
          <span className="font-mono text-foreground">30 SOL</span>
          <span className="text-muted-foreground">Decimals</span>
          <span className="font-mono text-foreground">6</span>
        </div>
      </div>
    </div>
  );
}

function ConfigRow({ icon: Icon, label, value, desc }: { icon: any; label: string; value: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
      <div className="flex-1">
        <div className="flex justify-between">
          <span className="text-xs font-medium text-foreground">{label}</span>
          <span className="text-xs font-mono text-primary">{value}</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function StatusRow({ label, status }: { label: string; status: "active" | "pending" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
        status === "active" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
      }`}>
        {status === "active" ? "Active" : "Pending"}
      </span>
    </div>
  );
}
