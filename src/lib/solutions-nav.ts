import { buildVoiceNav } from "@/lib/products/voice-nav";
import type { NavItem } from "@/lib/nav";
import {
  isSmartRoutingSectionPath,
  smartRoutingFlowIdFromPath,
} from "@/lib/smart-routing/display";

export type SolutionNavInstance = {
  id: string;
  label: string;
  status: string;
  href: string;
  children?: Array<{ label: string; href: string; badge?: string }>;
};

export type SolutionsNavOptions = {
  /** Kept for shell compatibility. */
  instancesBySolution?: Record<string, SolutionNavInstance[]>;
  primaryVoiceAgentId?: string | null;
  primarySmartRoutingFlowId?: string | null;
  /** Kept for shell compatibility (Messages nav removed in v1). */
  inboxBadge?: number;
};

/** Paths that belong under the AI Receptionist sidebar section. */
export const RECEPTIONIST_SECTION_PREFIXES = [
  "/voice/receptionist",
  "/voice/agents",
] as const;

export function isReceptionistSectionPath(pathname: string): boolean {
  return RECEPTIONIST_SECTION_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isSmartRoutingSectionPathExport(pathname: string): boolean {
  return isSmartRoutingSectionPath(pathname);
}

/** Legacy smart-routing nav — hidden from primary launch sidebar. */
export function buildSmartRoutingNavChildren(flowId?: string | null) {
  const fid = flowId ?? null;
  return [
    { label: "Overview", href: "/smart-routing" },
    { label: "Create Flow", href: "/smart-routing/new" },
    {
      label: "Call Flow Builder",
      href: fid ? `/smart-routing/${fid}` : "/smart-routing",
    },
    { label: "Audio", href: "/smart-routing/audio" },
    {
      label: "Test & Activate",
      href: fid ? `/smart-routing/${fid}/test` : "/smart-routing",
    },
    {
      label: "Activity",
      href: fid ? `/smart-routing/${fid}/activity` : "/smart-routing",
    },
  ];
}

/** Receptionist submenu under the primary launch sidebar. */
export function buildReceptionistNavChildren(agentId?: string | null) {
  const landing = "/voice/receptionist";
  const agentsList = "/voice/agents";
  if (!agentId) {
    return [
      { label: "Overview", href: landing },
      { label: "My Receptionists", href: agentsList },
      { label: "About Your Receptionist", href: "/voice/agents/new" },
      { label: "What It Should Do", href: agentsList },
      { label: "Connect Integrations", href: agentsList },
      { label: "Advanced", href: agentsList },
      { label: "Voice & Test", href: agentsList },
    ];
  }
  return [
    { label: "Overview", href: landing },
    { label: "My Receptionists", href: agentsList },
    { label: "About Your Receptionist", href: `/voice/agents/${agentId}/about` },
    { label: "What It Should Do", href: `/voice/agents/${agentId}/capabilities` },
    { label: "Connect Integrations", href: `/voice/agents/${agentId}/integrations` },
    { label: "Advanced", href: `/voice/agents/${agentId}/advanced` },
    { label: "Voice & Test", href: `/voice/agents/${agentId}/voice-test` },
  ];
}

/** Primary AI Receptionist product nav. */
export function buildProductNav(options: SolutionsNavOptions = {}): NavItem[] {
  return buildVoiceNav({ primaryVoiceAgentId: options.primaryVoiceAgentId ?? null });
}

/** Launch sidebar — simplified product nav. */
export function buildSolutionsNav(options: SolutionsNavOptions = {}): NavItem[] {
  return buildProductNav(options);
}

/** Static launch nav — used for titles / tests (no primary agent context). */
export const solutionsNav: NavItem[] = buildProductNav();

/** Alias — there is one app nav now. */
export const appSolutionsNav = solutionsNav;

/** Primary launch outcome slugs surfaced in the simplified sidebar. */
export function solutionsLaunchSlugs(): string[] {
  return ["voice-receptionist"];
}

export { smartRoutingFlowIdFromPath };
