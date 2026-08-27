import type { WorkspaceFeature, WorkspaceType } from "@/lib/workspace/types";

const PERSONAL_FEATURES: ReadonlySet<WorkspaceFeature> = new Set([
  "number_search",
  "premium_search",
  "buy_number",
  "number_vault",
  "forwarding",
  "voicemail",
  "port_in",
  "port_out",
  "call_logs",
  "smart_routing",
]);

const BUSINESS_BLOCKED_FOR_PERSONAL: ReadonlySet<WorkspaceFeature> = new Set([
  "ai_agent",
  "business_sms",
  "a2p",
  "campaigns",
  "automations",
  "crm_contacts",
  "appointments",
  "integrations",
]);

/** Central capability gate for workspace product surfaces. */
export function canUseFeature(
  workspaceType: WorkspaceType,
  feature: WorkspaceFeature,
): boolean {
  if (workspaceType === "PERSONAL") {
    if (BUSINESS_BLOCKED_FOR_PERSONAL.has(feature)) return false;
    return PERSONAL_FEATURES.has(feature);
  }
  return true;
}

export function workspaceHomePath(workspaceType: WorkspaceType): string {
  return workspaceType === "PERSONAL" ? "/dashboard" : "/dashboard";
}

/** Business-only URL prefixes — personal workspaces cannot access these pages. */
export const BUSINESS_ONLY_PATH_PREFIXES = [
  "/outcomes",
  "/systems",
  "/agents",
  "/voice",
  "/conversations",
  "/send",
  "/campaigns",
  "/templates",
  "/contacts",
  "/grow",
  "/automations",
  "/smart-routing",
  "/compliance",
  "/company-brain",
  "/integrations",
  "/reports",
  "/phone",
  "/messaging",
  "/getting-started",
  "/hire",
  "/realtor",
  "/my-numbers",
] as const;

export function isBusinessOnlyPath(pathname: string): boolean {
  if (pathname.startsWith("/personal")) return false;
  if (pathname.startsWith("/settings")) return false;
  if (pathname.startsWith("/numbers")) return false;
  if (pathname.startsWith("/onboarding")) return false;
  if (pathname === "/smart-routing" || pathname.startsWith("/smart-routing/")) {
    return false;
  }
  return BUSINESS_ONLY_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isPersonalOnlyPath(pathname: string): boolean {
  return pathname === "/personal" || pathname.startsWith("/personal/");
}
