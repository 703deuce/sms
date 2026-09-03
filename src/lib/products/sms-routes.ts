/**
 * SMS product route map — sidebar shows ~10 items; everything else is a deep route.
 */

/** Routes that should never show the SMS customer shell (legacy / other products). */
export const SMS_LEGACY_HIDDEN_PREFIXES = [
  "/outcomes",
  "/systems",
  "/hire",
  "/company-brain",
  "/phone",
  "/smart-routing",
  "/realtor",
  "/dev",
  "/agents",
  "/personal",
] as const;

/** Deep routes that keep the SMS shell but are not in the sidebar. */
export const SMS_DEEP_ROUTE_PREFIXES = [
  "/send",
  "/templates",
  "/compliance",
  "/integrations",
  "/messaging",
  "/surveys",
  "/solutions/missed-call-text-back",
  "/voice/agents",
] as const;

/** Core SMS app prefixes (sidebar sections + deep routes). */
export const SMS_APP_ROUTE_PREFIXES = [
  "/sms",
  "/sms/dashboard",
  "/sms/analytics",
  "/appointments",
  "/dashboard",
  "/conversations",
  "/inbox",
  "/analytics",
  "/campaigns",
  "/contacts",
  "/automations",
  "/auto-replies",
  "/drip-campaigns",
  "/ai-replies",
  "/grow",
  "/numbers",
  "/reports",
  "/settings",
  ...SMS_DEEP_ROUTE_PREFIXES,
] as const;

/** Numbers marketplace routes — Transovo Numbers product, not SMS texting numbers. */
export const NUMBERS_MARKETPLACE_PREFIXES = ["/numbers/premium", "/numbers/pools"] as const;

export function isNumbersMarketplacePath(pathname: string): boolean {
  return NUMBERS_MARKETPLACE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isSmsLegacyHidden(pathname: string): boolean {
  if (pathname.startsWith("/voice/agents")) return false;
  if (pathname.includes("missed-call-text-back")) return false;
  if (pathname.startsWith("/solutions/missed-call-text-back")) return false;
  return SMS_LEGACY_HIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isSmsDeepRoute(pathname: string): boolean {
  return SMS_DEEP_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** True when the authenticated SMS product chrome (sidebar/header) should render. */
export function isSmsShellRoute(pathname: string): boolean {
  if (isSmsLegacyHidden(pathname)) return false;
  if (isNumbersMarketplacePath(pathname)) return false;
  if (pathname === "/my-numbers" || pathname.startsWith("/my-numbers/")) return true;
  return SMS_APP_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Sidebar-visible SMS nav hrefs (flat — no children in menu). */
export const SMS_SIDEBAR_HREFS = [
  "/sms/dashboard",
  "/dashboard",
  "/conversations",
  "/sms/analytics",
  "/analytics",
  "/campaigns",
  "/contacts",
  "/playbooks",
  "/automations/drip-campaigns",
  "/grow",
  "/numbers",
  "/reports",
  "/settings",
] as const;

export type SmsCreateAction = {
  label: string;
  description: string;
  href: string;
};

export const SMS_CREATE_ACTIONS: SmsCreateAction[] = [
  {
    label: "Send Message",
    description: "Quick one-to-one text",
    href: "/send/quick",
  },
  {
    label: "Create Campaign",
    description: "Broadcast to a list or segment",
    href: "/campaigns/new",
  },
  {
    label: "Create Automation",
    description: "Trigger messages from events",
    href: "/automations/new",
  },
  {
    label: "Add Contact",
    description: "Create or import a contact",
    href: "/contacts",
  },
  {
    label: "Create Form",
    description: "Opt-in form or landing page",
    href: "/grow/forms",
  },
];

export const SMS_SEND_ACTIONS: SmsCreateAction[] = [
  { label: "Quick message", description: "Send to one contact", href: "/send/quick" },
  { label: "Campaign", description: "Create a broadcast", href: "/campaigns/new/promotion" },
  { label: "Write with AI", description: "Draft with AI assist", href: "/send/ai" },
  { label: "Test message", description: "Send a test to yourself", href: "/send/test" },
];
