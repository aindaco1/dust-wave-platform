export const ADMIN_RESPONSE_RULE_PHASE: 'http_response_cache_settings';
export interface AdminResponseRulePolicy {
  ruleRef: string;
  ruleDescription: string;
  rulesetName: string;
  rulesetDescription: string;
  adminPaths: string[];
  publicPaths: string[];
}
export function createAdminResponseRuleClient(policy: AdminResponseRulePolicy): Readonly<{
  phase: typeof ADMIN_RESPONSE_RULE_PHASE;
  policy: Readonly<AdminResponseRulePolicy>;
  buildAdminResponseRule(siteBase: string): Record<string, unknown>;
  adminResponseRuleMatches(actual: unknown, desired: unknown): boolean;
  verifyAdminResponsePolicy(options: { siteBase: string; fetchImpl?: typeof fetch; nonce?: () => string }): Promise<Record<string, unknown>>;
  configureAdminResponseRule(options: { siteBase: string; zoneId: string; token: string; apply?: boolean; fetchImpl?: typeof fetch }): Promise<Record<string, unknown>>;
}>;
