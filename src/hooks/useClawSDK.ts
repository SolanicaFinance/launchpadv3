import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Types based on database schema
export interface SaturnAgent {
  id: string;
  name: string;
  agent_type: string;
  owner_wallet: string;
  owner_profile_id: string | null;
  wallet_address: string;
  balance_sol: number;
  total_earned_sol: number;
  total_spent_sol: number;
  status: string;
  sandbox_type: string;
  allowed_fins: string[] | null;
  blocked_domains: string[] | null;
  total_fin_calls: number;
  total_ai_tokens_used: number;
  last_active_at: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaturnDNA {
  id: string;
  agent_id: string;
  personality: string;
  species_traits: string[] | null;
  voice_sample: string | null;
  migration_goals: any;
  reef_limits: string[] | null;
  echo_pattern: any;
  origin_story: string | null;
  preferred_model: string;
  fallback_model: string;
  version: number;
  updated_at: string;
}

export interface SaturnSonarConfig {
  id: string;
  agent_id: string;
  mode: string;
  interval_minutes: number;
  max_daily_cost_sol: number;
  current_daily_cost_sol: number;
  cost_reset_at: string | null;
  last_ping_at: string | null;
  next_ping_at: string | null;
  total_pings: number;
  is_paused: boolean;
  paused_reason: string | null;
}

export interface SaturnSonarPing {
  id: string;
  agent_id: string;
  action: string;
  priority: number | null;
  reasoning: string | null;
  executed_at: string;
  execution_result: any;
  success: boolean | null;
  error_message: string | null;
  cost_sol: number;
  tokens_used: number | null;
  context_snapshot: any;
}

export interface SaturnFin {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category: string;
  endpoint: string | null;
  handler_code: string | null;
  permission_scope: string[] | null;
  cost_sol: number;
  is_native: boolean;
  provider_agent_id: string | null;
  provider_wallet: string | null;
  is_verified: boolean;
  security_scan_passed: boolean;
  verified_at: string | null;
  total_uses: number;
  success_rate: number;
  avg_execution_ms: number | null;
  created_at: string;
}

export interface SaturnCurrentFlow {
  id: string;
  requester_agent_id: string;
  provider_agent_id: string | null;
  fin_id: string | null;
  service_name: string | null;
  amount_sol: number;
  tide_receipt_id: string;
  memo: string;
  signature: string | null;
  status: string;
  request_payload: any;
  response_payload: any;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
}

export interface SaturnDeepMemory {
  id: string;
  agent_id: string;
  content: string;
  memory_type: string;
  importance: number;
  recalled_count: number;
  last_recalled_at: string | null;
  metadata: any;
  tags: string[] | null;
  created_at: string;
  expires_at: string | null;
}

// Fetch all agents for the connected wallet
export function useSaturnAgents(walletAddress: string | null) {
  return useQuery({
    queryKey: ['clawsdk-agents', walletAddress],
    queryFn: async () => {
      if (!walletAddress) return [];
      
      const { data, error } = await supabase
        .from('opentuna_agents')
        .select('*')
        .eq('owner_wallet', walletAddress)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as SaturnAgent[];
    },
    enabled: !!walletAddress,
  });
}

// Fetch single agent by ID
export function useSaturnAgent(agentId: string | null) {
  return useQuery({
    queryKey: ['clawsdk-agent', agentId],
    queryFn: async () => {
      if (!agentId) return null;
      
      const { data, error } = await supabase
        .from('opentuna_agents')
        .select('*')
        .eq('id', agentId)
        .single();
      
      if (error) throw error;
      return data as SaturnAgent;
    },
    enabled: !!agentId,
  });
}

// Fetch DNA for an agent
export function useSaturnDNA(agentId: string | null) {
  return useQuery({
    queryKey: ['clawsdk-dna', agentId],
    queryFn: async () => {
      if (!agentId) return null;
      
      const { data, error } = await supabase
        .from('opentuna_dna')
        .select('*')
        .eq('agent_id', agentId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as SaturnDNA | null;
    },
    enabled: !!agentId,
  });
}

// Fetch Sonar config for an agent
export function useSaturnSonarConfig(agentId: string | null) {
  return useQuery({
    queryKey: ['clawsdk-sonar-config', agentId],
    queryFn: async () => {
      if (!agentId) return null;
      
      const { data, error } = await supabase
        .from('opentuna_sonar_config')
        .select('*')
        .eq('agent_id', agentId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as SaturnSonarConfig | null;
    },
    enabled: !!agentId,
  });
}

// Fetch recent pings for an agent
export function useSaturnSonarPings(agentId: string | null, limit = 20) {
  return useQuery({
    queryKey: ['clawsdk-sonar-pings', agentId, limit],
    queryFn: async () => {
      if (!agentId) return [];
      
      const { data, error } = await supabase
        .from('opentuna_sonar_pings')
        .select('*')
        .eq('agent_id', agentId)
        .order('executed_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as SaturnSonarPing[];
    },
    enabled: !!agentId,
  });
}

// Fetch all available fins
export function useSaturnFins() {
  return useQuery({
    queryKey: ['clawsdk-fins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('opentuna_fins')
        .select('*')
        .order('is_native', { ascending: false })
        .order('total_uses', { ascending: false });
      
      if (error) throw error;
      return data as SaturnFin[];
    },
  });
}

// Fetch installed fins for an agent
export function useSaturnFinRack(agentId: string | null) {
  return useQuery({
    queryKey: ['clawsdk-fin-rack', agentId],
    queryFn: async () => {
      if (!agentId) return [];
      
      const { data, error } = await supabase
        .from('opentuna_fin_rack')
        .select(`
          *,
          fin:opentuna_fins(*)
        `)
        .eq('agent_id', agentId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!agentId,
  });
}

// Fetch transactions for an agent
export function useSaturnCurrentFlows(agentId: string | null, limit = 20) {
  return useQuery({
    queryKey: ['clawsdk-current-flows', agentId, limit],
    queryFn: async () => {
      if (!agentId) return [];
      
      const { data, error } = await supabase
        .from('opentuna_current_flows')
        .select('*')
        .or(`requester_agent_id.eq.${agentId},provider_agent_id.eq.${agentId}`)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as SaturnCurrentFlow[];
    },
    enabled: !!agentId,
  });
}

// Fetch memories for an agent
export function useSaturnMemories(agentId: string | null, memoryType?: string, limit = 20) {
  return useQuery({
    queryKey: ['clawsdk-memories', agentId, memoryType, limit],
    queryFn: async () => {
      if (!agentId) return [];
      
      let query = supabase
        .from('opentuna_deep_memory')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (memoryType && memoryType !== 'all') {
        query = query.eq('memory_type', memoryType);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as SaturnDeepMemory[];
    },
    enabled: !!agentId,
  });
}

// Fetch platform stats (all agents, total pings, etc.)
export function useSaturnStats() {
  return useQuery({
    queryKey: ['clawsdk-stats'],
    queryFn: async () => {
      // Get total agents
      const { count: agentCount } = await supabase
        .from('opentuna_agents')
        .select('*', { count: 'exact', head: true });
      
      // Get total pings today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count: pingCount } = await supabase
        .from('opentuna_sonar_pings')
        .select('*', { count: 'exact', head: true })
        .gte('executed_at', today.toISOString());
      
      // Get economy volume (sum of completed transactions)
      const { data: flows } = await supabase
        .from('opentuna_current_flows')
        .select('amount_sol')
        .eq('status', 'completed');
      
      const totalVolume = flows?.reduce((sum, f) => sum + Number(f.amount_sol), 0) || 0;
      
      return {
        totalAgents: agentCount || 0,
        totalPingsToday: pingCount || 0,
        economyVolume: totalVolume,
        avgUptime: 99.2, // Placeholder - would need actual uptime tracking
      };
    },
  });
}

// Mutation: Create a new agent
export function useCreateSaturnAgent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (params: {
      name: string;
      agentType: string;
      ownerWallet: string;
      personality: string;
      firstGoal?: string;
      speciesTraits?: string[];
      reefLimits?: string[];
    }) => {
      const { data, error } = await supabase.functions.invoke('opentuna-agent-hatch', {
        body: params,
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clawsdk-agents', variables.ownerWallet] });
      queryClient.invalidateQueries({ queryKey: ['clawsdk-stats'] });
      toast({
        title: "Agent Hatched! 🦀",
        description: `${variables.name} is now alive. Fund it to activate.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Hatch Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Mutation: Update DNA
export function useUpdateSaturnDNA() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (params: {
      agentId: string;
      personality?: string;
      speciesTraits?: string[];
      migrationGoals?: any[];
      reefLimits?: string[];
      echoPattern?: any;
    }) => {
      const { data, error } = await supabase
        .from('opentuna_dna')
        .update({
          personality: params.personality,
          species_traits: params.speciesTraits,
          migration_goals: params.migrationGoals,
          reef_limits: params.reefLimits,
          echo_pattern: params.echoPattern,
          updated_at: new Date().toISOString(),
        })
        .eq('agent_id', params.agentId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clawsdk-dna', variables.agentId] });
      toast({
        title: "DNA Updated",
        description: "Agent personality and goals saved.",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Mutation: Update Sonar config
export function useUpdateSaturnSonar() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (params: {
      agentId: string;
      mode?: string;
      intervalMinutes?: number;
      maxDailyCostSol?: number;
      isPaused?: boolean;
      pausedReason?: string;
    }) => {
      const updates: any = {};
      if (params.mode) {
        updates.mode = params.mode;
        updates.interval_minutes = {
          drift: 60,
          cruise: 15,
          hunt: 5,
          frenzy: 1,
        }[params.mode] || 15;
      }
      if (params.maxDailyCostSol !== undefined) {
        updates.max_daily_cost_sol = params.maxDailyCostSol;
      }
      if (params.isPaused !== undefined) {
        updates.is_paused = params.isPaused;
        updates.paused_reason = params.pausedReason || null;
      }
      
      const { data, error } = await supabase
        .from('opentuna_sonar_config')
        .update(updates)
        .eq('agent_id', params.agentId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clawsdk-sonar-config', variables.agentId] });
      toast({
        title: "Sonar Updated",
        description: variables.isPaused !== undefined 
          ? (variables.isPaused ? "Agent paused" : "Agent resumed")
          : "Mode changed successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Mutation: Install a fin
export function useInstallSaturnFin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (params: { agentId: string; finId: string }) => {
      const { data, error } = await supabase
        .from('opentuna_fin_rack')
        .insert({
          agent_id: params.agentId,
          fin_id: params.finId,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clawsdk-fin-rack', variables.agentId] });
      toast({
        title: "Fin Installed",
        description: "New capability added to your agent.",
      });
    },
    onError: (error) => {
      toast({
        title: "Install Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// ============================================================================
// API KEY MANAGEMENT
// ============================================================================

export interface SaturnApiKey {
  id: string;
  agent_id: string;
  key_prefix: string;
  name: string | null;
  last_used_at: string | null;
  total_requests: number;
  is_active: boolean;
  created_at: string;
}

// Fetch API keys for an agent
export function useSaturnApiKeys(agentId: string | null) {
  return useQuery({
    queryKey: ['clawsdk-api-keys', agentId],
    queryFn: async () => {
      if (!agentId) return [];
      
      const { data, error } = await supabase
        .from('opentuna_api_keys')
        .select('*')
        .eq('agent_id', agentId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as SaturnApiKey[];
    },
    enabled: !!agentId,
  });
}

// Mutation: Generate API key
export function useCreateSaturnApiKey() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (params: { agentId: string; name?: string }) => {
      const { data, error } = await supabase.functions.invoke('opentuna-api-key-create', {
        body: params,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clawsdk-api-keys', variables.agentId] });
      toast({
        title: "API Key Generated!",
        description: "Copy it now - it won't be shown again.",
      });
    },
    onError: (error) => {
      toast({
        title: "Key Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Mutation: Revoke API key
export function useRevokeSaturnApiKey() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (params: { keyId: string; agentId: string }) => {
      const { data, error } = await supabase.functions.invoke('opentuna-api-key-revoke', {
        body: { keyId: params.keyId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clawsdk-api-keys', variables.agentId] });
      toast({
        title: "Key Revoked",
        description: "This API key can no longer be used.",
      });
    },
    onError: (error) => {
      toast({
        title: "Revoke Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// ============================================================================
// RECENT ACTIVITY FEED
// ============================================================================

export interface RecentActivity {
  id: string;
  agent_id: string;
  action: string;
  reasoning: string | null;
  executed_at: string;
  success: boolean | null;
  cost_sol: number;
  agent_name?: string;
}

// Fetch recent activity across all user's agents
export function useRecentActivity(agentIds: string[], limit = 10) {
  return useQuery({
    queryKey: ['clawsdk-recent-activity', agentIds, limit],
    queryFn: async () => {
      if (agentIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('opentuna_sonar_pings')
        .select(`
          id,
          agent_id,
          action,
          reasoning,
          executed_at,
          success,
          cost_sol
        `)
        .in('agent_id', agentIds)
        .order('executed_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as RecentActivity[];
    },
    enabled: agentIds.length > 0,
    refetchInterval: 30000, // Refresh every 30s
  });
}
