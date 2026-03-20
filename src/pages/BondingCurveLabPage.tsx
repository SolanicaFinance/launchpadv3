import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LabCreatePool } from "@/components/lab/LabCreatePool";
import { LabTradePanel } from "@/components/lab/LabTradePanel";
import { LabPoolState } from "@/components/lab/LabPoolState";
import { LabGraduationMonitor } from "@/components/lab/LabGraduationMonitor";
import { LabConfig } from "@/components/lab/LabConfig";
import type { LabPool, LabTrade } from "@/lib/saturn-curve";
import { FlaskConical, Lock } from "lucide-react";

const ADMIN_KEY = "admin_panel_auth_v2";
const ADMIN_PASS = "saturn135@";

export default function BondingCurveLabPage() {
  const [authed, setAuthed] = useState(() => localStorage.getItem(ADMIN_KEY) === ADMIN_PASS);
  const [passInput, setPassInput] = useState("");
  const [pools, setPools] = useState<LabPool[]>([]);
  const [trades, setTrades] = useState<LabTrade[]>([]);

  const fetchData = useCallback(async () => {
    const [poolRes, tradeRes] = await Promise.all([
      supabase.from("lab_pools").select("*").order("created_at", { ascending: false }),
      supabase.from("lab_trades").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    if (poolRes.data) setPools(poolRes.data as unknown as LabPool[]);
    if (tradeRes.data) setTrades(tradeRes.data as unknown as LabTrade[]);
  }, []);

  useEffect(() => {
    if (authed) fetchData();
  }, [authed, fetchData]);

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-bold text-foreground">Bonding Curve Lab</h1>
          <p className="text-xs text-muted-foreground">Enter admin password to access</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (passInput === ADMIN_PASS) {
                localStorage.setItem(ADMIN_KEY, ADMIN_PASS);
                setAuthed(true);
              }
            }}
            className="flex gap-2"
          >
            <Input type="password" value={passInput} onChange={(e) => setPassInput(e.target.value)} placeholder="Password" />
            <Button type="submit">Enter</Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <FlaskConical className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold text-foreground">Bonding Curve Lab</h1>
        <span className="px-2 py-0.5 rounded text-[10px] bg-yellow-500/20 text-yellow-400 font-bold">DEV</span>
      </div>

      <Tabs defaultValue="create" className="space-y-4">
        <TabsList className="bg-muted/50 w-full justify-start overflow-x-auto">
          <TabsTrigger value="create">Create Pool</TabsTrigger>
          <TabsTrigger value="trade">Trade</TabsTrigger>
          <TabsTrigger value="state">Pool State</TabsTrigger>
          <TabsTrigger value="graduation">Graduation</TabsTrigger>
          <TabsTrigger value="config">Config</TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <LabCreatePool onPoolCreated={fetchData} />
        </TabsContent>
        <TabsContent value="trade">
          <LabTradePanel pools={pools} trades={trades} onTradeExecuted={fetchData} />
        </TabsContent>
        <TabsContent value="state">
          <LabPoolState pools={pools} />
        </TabsContent>
        <TabsContent value="graduation">
          <LabGraduationMonitor pools={pools} onGraduated={fetchData} />
        </TabsContent>
        <TabsContent value="config">
          <LabConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}
