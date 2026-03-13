// System agent uses static avatar
export const SYSTEM_CLAW_ID = "00000000-0000-0000-0000-000000000001";
export const SYSTEM_CLAW_AVATAR = "/saturn-logo.png";

// Backwards compat aliases
export const SYSTEM_TUNA_ID = SYSTEM_CLAW_ID;
export const SYSTEM_TUNA_AVATAR = SYSTEM_CLAW_AVATAR;

/**
 * Get avatar URL for an agent
 * Priority: agent.avatar_url > first launched token image > fallback null (use initial)
 */
export function getAgentAvatarUrl(
  agentId: string,
  agentAvatarUrl?: string | null,
  tokenImageUrl?: string | null
): string | null {
  // System agent always uses the static avatar
  if (agentId === SYSTEM_CLAW_ID) {
    return SYSTEM_CLAW_AVATAR;
  }
  // Use agent's own avatar if set
  if (agentAvatarUrl) {
    return agentAvatarUrl;
  }
  // Fall back to token image
  if (tokenImageUrl) {
    return tokenImageUrl;
  }
  return null;
}
