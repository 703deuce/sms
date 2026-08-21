import {
  LayoutDashboard,
  Inbox,
  Users,
  Megaphone,
  MessageSquare,
  Workflow,
  FileText,
  Sprout,
  BarChart3,
  Phone,
  Hash,
  ShieldCheck,
  Puzzle,
  Settings,
  AudioLines,
  ClipboardList,
  PhoneCall,
  type LucideIcon,
} from "lucide-react";

/** Leaf link in the sidebar. */
export type NavLink = {
  type?: "link";
  label: string;
  href: string;
  badge?: string;
};

/** Visual group header with nested links (not a route by itself). */
export type NavGroup = {
  type: "group";
  label: string;
  children: NavLink[];
};

export type NavChild = NavLink | NavGroup;

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: NavChild[];
  badge?: string | number;
  emphasize?: boolean;
  /** Major sidebar band (Solutions / Manage / Advanced). */
  sectionLabel?: string;
  /** Product-area header under a major band (AI Receptionist, SMS, …). */
  areaLabel?: string;
};

/** @deprecated use NavLink — kept for gradual call-site typing */
export type NavChildLegacy = { label: string; href: string };

export function isNavGroup(child: NavChild): child is NavGroup {
  return child.type === "group";
}

export function flattenNavLinks(children: NavChild[] | undefined): NavLink[] {
  if (!children?.length) return [];
  const out: NavLink[] = [];
  for (const child of children) {
    if (isNavGroup(child)) out.push(...child.children);
    else out.push(child);
  }
  return out;
}

export function collectNavHrefs(items: NavItem[]): string[] {
  const hrefs = new Set<string>();
  for (const item of items) {
    hrefs.add(item.href);
    for (const link of flattenNavLinks(item.children)) {
      hrefs.add(link.href);
    }
  }
  return [...hrefs].sort();
}

/**
 * Every href that was reachable from the previous flat appNav.
 * Navigation migration is incomplete if any of these are missing.
 */
export const LEGACY_APP_NAV_HREFS = [
  "/dashboard",
  "/inbox",
  "/inbox/mine",
  "/inbox/unassigned",
  "/campaigns",
  "/messaging/media",
  "/messaging/links",
  "/messaging/payments",
  "/templates",
  "/send/ai",
  "/contacts",
  "/contacts/lists",
  "/contacts/segments",
  "/contacts/tags",
  "/contacts/fields",
  "/contacts/imports",
  "/contacts/validation",
  "/contacts/unsubscribed",
  "/contacts/blocked",
  "/contacts/invalid",
  "/automations",
  "/automations/templates",
  "/automations/new",
  "/automations/logs",
  "/surveys",
  "/surveys?type=poll",
  "/surveys?type=nps",
  "/grow/keywords",
  "/grow/forms",
  "/grow/popups",
  "/grow/pages",
  "/grow/qr-codes",
  "/grow/click-to-text",
  "/grow/contests",
  "/grow/contact-cards",
  "/grow/sources",
  "/voice/overview",
  "/voice/agents",
  "/voice/ai-platform",
  "/voice/knowledge",
  "/voice/tools",
  "/voice/calendars",
  "/voice/testing",
  "/voice/numbers",
  "/voice/inbound-routing",
  "/voice/campaigns",
  "/voice/calls",
  "/voice/conversations",
  "/voice/analytics",
  "/voice/billing",
  "/voice/settings",
  "/reports",
  "/reports/campaigns",
  "/reports/messages",
  "/reports/contacts",
  "/reports/inbox",
  "/reports/automations",
  "/reports/links",
  "/reports/usage",
  "/reports/integrations",
  "/numbers",
  "/phone",
  "/phone/calls",
  "/phone/queues",
  "/phone/ivr",
  "/phone/settings",
  "/compliance",
  "/integrations",
  "/integrations/native",
  "/integrations/crm",
  "/integrations/crm/pipeline",
  "/integrations/native/tasks",
  "/integrations/native/orders",
  "/integrations/native/leads",
  "/integrations/native/appointments",
  "/integrations/native/audit",
  "/integrations/native/ai-policy",
  "/integrations/api",
  "/integrations/webhooks",
  "/integrations/logs",
  "/settings/business",
] as const;

export const appNav: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Messaging",
    href: "/inbox",
    icon: MessageSquare,
    children: [
      {
        type: "group",
        label: "Inbox",
        children: [
          { label: "All Conversations", href: "/inbox" },
          { label: "Assigned to Me", href: "/inbox/mine" },
          { label: "Unassigned", href: "/inbox/unassigned" },
        ],
      },
      {
        type: "group",
        label: "Campaigns",
        children: [
          { label: "All Campaigns", href: "/campaigns" },
          { label: "Send Campaign", href: "/send" },
        ],
      },
      {
        type: "group",
        label: "Message Creation",
        children: [
          { label: "Templates", href: "/templates" },
          { label: "AI Composer", href: "/send/ai" },
        ],
      },
      {
        type: "group",
        label: "Content & Tracking",
        children: [
          { label: "Media & MMS", href: "/messaging/media" },
          { label: "Link Tracking", href: "/messaging/links" },
        ],
      },
      {
        type: "group",
        label: "Payments",
        children: [{ label: "Text-to-Pay", href: "/messaging/payments" }],
      },
    ],
  },
  {
    label: "Contacts",
    href: "/contacts",
    icon: Users,
    children: [
      { label: "All Contacts", href: "/contacts" },
      {
        type: "group",
        label: "Organization",
        children: [
          { label: "Lists", href: "/contacts/lists" },
          { label: "Segments", href: "/contacts/segments" },
          { label: "Tags", href: "/contacts/tags" },
          { label: "Custom Fields", href: "/contacts/fields" },
        ],
      },
      {
        type: "group",
        label: "Data Management",
        children: [
          { label: "Imports", href: "/contacts/imports" },
          { label: "Validation", href: "/contacts/validation" },
        ],
      },
      {
        type: "group",
        label: "Suppression & Deliverability",
        children: [
          { label: "Unsubscribed", href: "/contacts/unsubscribed" },
          { label: "Blocked", href: "/contacts/blocked" },
          { label: "Invalid", href: "/contacts/invalid" },
        ],
      },
    ],
  },
  {
    label: "Automations",
    href: "/automations",
    icon: Workflow,
    children: [
      { label: "Flows", href: "/automations" },
      { label: "Templates", href: "/automations/templates" },
      { label: "Builder", href: "/automations/new" },
      { label: "Run History", href: "/automations/logs" },
    ],
  },
  {
    label: "Growth",
    href: "/grow/keywords",
    icon: Sprout,
    children: [
      { label: "SMS Keywords", href: "/grow/keywords" },
      {
        type: "group",
        label: "Lead Capture",
        children: [
          { label: "Forms", href: "/grow/forms" },
          { label: "Popups & Widgets", href: "/grow/popups" },
          { label: "Signup Pages", href: "/grow/pages" },
          { label: "Click-to-Text", href: "/grow/click-to-text" },
        ],
      },
      {
        type: "group",
        label: "QR & Sharing",
        children: [
          { label: "QR Codes", href: "/grow/qr-codes" },
          { label: "Contact Cards", href: "/grow/contact-cards" },
        ],
      },
      {
        type: "group",
        label: "Engagement",
        children: [{ label: "Contests", href: "/grow/contests" }],
      },
      {
        type: "group",
        label: "Attribution",
        children: [{ label: "Sources", href: "/grow/sources" }],
      },
    ],
  },
  {
    label: "Surveys",
    href: "/surveys",
    icon: ClipboardList,
    children: [
      { label: "All Surveys", href: "/surveys" },
      { label: "Polls", href: "/surveys?type=poll" },
      { label: "NPS", href: "/surveys?type=nps" },
    ],
  },
  {
    label: "AI Voice",
    href: "/voice/overview",
    icon: AudioLines,
    children: [
      { label: "Overview", href: "/voice/overview" },
      {
        type: "group",
        label: "Build",
        children: [
          { label: "Agents", href: "/voice/agents" },
          { label: "AI Platform", href: "/voice/ai-platform" },
          { label: "Knowledge Bases", href: "/voice/knowledge" },
          { label: "Tools", href: "/voice/tools" },
          { label: "Calendars", href: "/voice/calendars" },
        ],
      },
      {
        type: "group",
        label: "Numbers & Routing",
        children: [
          { label: "AI Phone Numbers", href: "/voice/numbers" },
          { label: "Inbound Routing", href: "/voice/inbound-routing" },
        ],
      },
      {
        type: "group",
        label: "Operations",
        children: [
          { label: "Testing Lab", href: "/voice/testing" },
          { label: "Outbound Campaigns", href: "/voice/campaigns" },
        ],
      },
      {
        type: "group",
        label: "Activity",
        children: [
          { label: "Calls", href: "/voice/calls" },
          { label: "Conversations", href: "/voice/conversations" },
        ],
      },
      {
        type: "group",
        label: "Performance",
        children: [
          { label: "Analytics", href: "/voice/analytics" },
          { label: "Usage & Billing", href: "/voice/billing" },
        ],
      },
      {
        type: "group",
        label: "Configuration",
        children: [{ label: "Settings", href: "/voice/settings" }],
      },
    ],
  },
  {
    label: "Business Phone",
    href: "/phone",
    icon: Phone,
    children: [
      { label: "Softphone", href: "/phone" },
      { label: "Call History", href: "/phone/calls" },
      { label: "Queues", href: "/phone/queues" },
      { label: "IVR Menus", href: "/phone/ivr" },
      { label: "Settings", href: "/phone/settings" },
    ],
  },
  {
    label: "Reports",
    href: "/reports",
    icon: BarChart3,
    children: [
      { label: "Overview", href: "/reports" },
      {
        type: "group",
        label: "Messaging",
        children: [
          { label: "Campaigns", href: "/reports/campaigns" },
          { label: "Messages", href: "/reports/messages" },
          { label: "Inbox", href: "/reports/inbox" },
          { label: "Links", href: "/reports/links" },
        ],
      },
      {
        type: "group",
        label: "Customers",
        children: [{ label: "Contacts", href: "/reports/contacts" }],
      },
      {
        type: "group",
        label: "Workflows",
        children: [{ label: "Automations", href: "/reports/automations" }],
      },
      {
        type: "group",
        label: "Platform",
        children: [
          { label: "Usage", href: "/reports/usage" },
          { label: "Integrations", href: "/reports/integrations" },
        ],
      },
    ],
  },
  {
    label: "Phone Numbers",
    href: "/numbers",
    icon: Hash,
    children: [{ label: "My Numbers", href: "/numbers" }],
  },
  {
    label: "Integrations",
    href: "/integrations",
    icon: Puzzle,
    children: [
      { label: "Directory", href: "/integrations" },
      { label: "Connect Apps", href: "/integrations/native" },
      {
        type: "group",
        label: "CRM",
        children: [
          { label: "CRM Connections", href: "/integrations/crm" },
          { label: "CRM Pipeline", href: "/integrations/crm/pipeline" },
        ],
      },
      {
        type: "group",
        label: "Integration Data",
        children: [
          { label: "Tasks", href: "/integrations/native/tasks" },
          { label: "Orders", href: "/integrations/native/orders" },
          { label: "Lead Inbox", href: "/integrations/native/leads" },
          { label: "Appointments", href: "/integrations/native/appointments" },
        ],
      },
      {
        type: "group",
        label: "Governance",
        children: [
          { label: "Action Audit", href: "/integrations/native/audit" },
          { label: "AI Safety", href: "/integrations/native/ai-policy" },
        ],
      },
      {
        type: "group",
        label: "Developer",
        children: [
          { label: "API Keys", href: "/integrations/api" },
          { label: "Webhooks", href: "/integrations/webhooks" },
          { label: "Developer Logs", href: "/integrations/logs" },
        ],
      },
    ],
  },
  { label: "Compliance", href: "/compliance", icon: ShieldCheck },
  { label: "Settings", href: "/settings/business", icon: Settings },
];

export const mobilePrimaryNav = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Calls", href: "/voice/calls", icon: PhoneCall },
  { label: "Receptionist", href: "/voice/receptionist", icon: AudioLines },
];

export const adminNav: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Customers", href: "/admin/customers", icon: Users },
  { label: "A2P Queue", href: "/admin/a2p", icon: ShieldCheck },
  { label: "Monitoring", href: "/admin/monitoring", icon: BarChart3 },
  { label: "Numbers", href: "/admin/numbers", icon: Phone },
  { label: "Billing", href: "/admin/billing", icon: FileText },
  { label: "Support", href: "/admin/support", icon: Inbox },
  { label: "System Logs", href: "/admin/logs", icon: Workflow },
  { label: "Platform Settings", href: "/admin/settings", icon: Settings },
];

export const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/getting-started": "Getting Started",
  "/outcomes": "Dashboard",
  "/systems": "Your Team",
  "/agents": "Your Team",
  "/my-numbers": "My Numbers",
  "/solutions": "Solution Center",
  "/solutions/lead-recovery": "Lead Recovery",
  "/solutions/lead-recovery/missed-call-text-back": "Missed Call Text Back",
  "/solutions/lead-recovery/lead-follow-up": "Lead Follow-Up",
  "/solutions/lead-recovery/customer-reactivation": "Customer Reactivation",
  "/solutions/ai-call-handling": "AI Call Handling",
  "/solutions/ai-call-handling/ai-answering-machine": "AI Answering Machine",
  "/solutions/ai-call-handling/after-hours-assistant": "After-Hours Assistant",
  "/solutions/ai-call-handling/lead-intake-assistant": "Lead Intake Assistant",
  "/solutions/ai-call-handling/appointment-assistant": "Answer Calls & Book Appointments",
  "/solutions/ai-call-handling/appointment-assistant/setup": "Create AI Receptionist",
  "/solutions/customer-growth": "Customer Growth",
  "/solutions/customer-growth/automated-review-requests": "Automated Review Requests",
  "/solutions/customer-growth/appointment-reminders": "Appointment Reminders",
  "/solutions/customer-growth/customer-surveys": "Customer Surveys",
  "/solutions/team-performance": "Team Performance",
  "/solutions/team-performance/sales-call-intelligence": "Sales Call Intelligence",
  "/solutions/team-performance/call-quality-coaching": "Call Quality & Coaching",
  "/solutions/custom": "Custom Solutions",
  "/solutions/custom/build": "Build a Custom Solution",
  "/send": "New Campaign",
  "/send/quick": "Quick Send",
  "/send/test": "Test Message",
  "/send/ai": "AI Campaign Composer",
  "/inbox": "Inbox",
  "/inbox/mine": "Assigned to Me",
  "/inbox/unassigned": "Unassigned",
  "/inbox/archived": "Archived",
  "/inbox/saved-replies": "Saved Replies",
  "/messaging/media": "Media Library",
  "/messaging/links": "Link Tracking",
  "/messaging/payments": "Text-to-pay",
  "/contacts": "All Contacts",
  "/contacts/lists": "Lists",
  "/contacts/segments": "Segments",
  "/contacts/tags": "Tags",
  "/contacts/imports": "Imports",
  "/contacts/fields": "Custom Fields",
  "/contacts/validation": "List Validation",
  "/contacts/unsubscribed": "Unsubscribed",
  "/contacts/blocked": "Blocked",
  "/contacts/invalid": "Invalid Numbers",
  "/campaigns": "Campaigns",
  "/campaigns/drafts": "Draft Campaigns",
  "/campaigns/scheduled": "Scheduled Campaigns",
  "/campaigns/calendar": "Campaign Calendar",
  "/campaigns/completed": "Completed Campaigns",
  "/campaigns/failed": "Failed Campaigns",
  "/campaigns/recurring": "Recurring Campaigns",
  "/automations": "Automations",
  "/automations/new": "New Automation",
  "/automations/templates": "Automation Templates",
  "/automations/logs": "Automation Run History",
  "/surveys": "Surveys",
  "/voice/overview": "AI Voice Overview",
  "/voice/receptionist": "AI Receptionist",
  "/voice/agents": "My Agents",
  "/voice/agents/new": "Agent Builder",
  "/voice/ai-platform": "AI Voice Platform",
  "/voice/numbers": "Voice Phone Numbers",
  "/voice/inbound-routing": "Inbound Routing",
  "/voice/campaigns": "Outbound Campaigns",
  "/voice/calls": "Voice Calls",
  "/voice/conversations": "Voice Conversations",
  "/voice/knowledge": "Knowledge Bases",
  "/voice/tools": "Voice Tools",
  "/voice/calendars": "Voice Calendars",
  "/voice/analytics": "Voice Analytics",
  "/voice/testing": "Voice Testing Lab",
  "/voice/billing": "Voice Usage & Billing",
  "/voice/settings": "Voice Settings",
  "/templates": "Templates",
  "/templates/new": "Create Template",
  "/templates/ai": "AI Template Generator",
  "/grow/keywords": "SMS Keywords",
  "/grow/forms": "Opt-in Forms",
  "/grow/popups": "Popups & Widgets",
  "/grow/contests": "Contests",
  "/grow/contact-cards": "Contact Cards",
  "/grow/qr-codes": "QR Codes",
  "/grow/pages": "Signup Pages",
  "/grow/sources": "Subscriber Sources",
  "/grow/click-to-text": "Click-to-Text",
  "/reports": "Reports Overview",
  "/reports/campaigns": "Campaign Reports",
  "/reports/messages": "Message Reports",
  "/reports/contacts": "Contact Growth",
  "/reports/inbox": "Inbox Reports",
  "/reports/automations": "Automation Reports",
  "/reports/links": "Link Reports",
  "/reports/usage": "Usage & Cost",
  "/reports/audit-log": "Audit Log",
  "/reports/integrations": "Integration Reports",
  "/numbers": "Phone Numbers",
  "/numbers/buy": "Buy Number",
  "/numbers/premium": "Premium Numbers",
  "/numbers/port": "Port Number",
  "/numbers/pools": "Sender Pools",
  "/phone": "Softphone",
  "/phone/calls": "Call History",
  "/phone/queues": "Call Queues",
  "/phone/ivr": "IVR Menus",
  "/phone/settings": "Phone Settings",
  "/compliance": "Compliance",
  "/compliance/business": "Business Profile",
  "/compliance/brand": "Brand Registration",
  "/compliance/campaign": "Campaign Registration",
  "/compliance/check": "Registration Readiness",
  "/compliance/consent": "Consent Records",
  "/compliance/suppression": "Suppression List",
  "/compliance/events": "Compliance Events",
  "/integrations": "Integrations",
  "/integrations/native": "Connect Apps",
  "/integrations/crm": "CRM Integrations",
  "/integrations/crm/pipeline": "CRM Pipeline",
  "/integrations/native/tasks": "Unified Tasks",
  "/integrations/native/appointments": "Appointments",
  "/integrations/native/orders": "Orders",
  "/integrations/native/leads": "Lead Inbox",
  "/integrations/native/audit": "Action Audit",
  "/integrations/native/ai-policy": "AI Safety",
  "/integrations/api": "API Keys",
  "/integrations/webhooks": "Webhooks",
  "/integrations/logs": "Developer Logs",
  "/settings/business": "Business Settings",
  "/settings/messaging": "Messaging Settings",
  "/settings/email-to-sms": "Email-to-SMS",
  "/settings/users": "Users & Permissions",
  "/settings/workspaces": "Workspaces",
  "/settings/notifications": "Notifications",
  "/settings/billing": "Billing",
  "/settings/limits": "Usage Limits",
  "/settings/security": "Security",
  "/settings/branding": "Branding",
  "/settings/data": "Data & Privacy",
  "/admin": "Admin Dashboard",
  "/admin/customers": "Customers",
  "/admin/a2p": "A2P Registrations",
  "/admin/monitoring": "Message Monitoring",
  "/admin/numbers": "Platform Numbers",
  "/admin/billing": "Platform Billing",
  "/admin/support": "Support",
  "/admin/logs": "System Logs",
  "/admin/settings": "Platform Settings",
};

export function getPageTitle(pathname: string) {
  if (pageTitles[pathname]) return pageTitles[pathname];
  if (pathname.startsWith("/outcomes/")) {
    const parts = pathname.split("/").filter(Boolean);
    // /outcomes/:solution(/:section)
    if (parts[1]) {
      const pretty = parts
        .slice(1)
        .map((p) =>
          p
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" "),
        )
        .join(" · ");
      return pretty || "Solutions";
    }
    return "Solutions Dashboard";
  }
  if (pathname.startsWith("/solutions/")) return "Solutions";
  if (pathname.startsWith("/campaigns/")) return "Campaign Detail";
  if (pathname.startsWith("/contacts/")) return "Contact Detail";
  if (pathname.startsWith("/automations/")) return "Automation Detail";
  if (pathname.startsWith("/surveys/")) return "Survey Detail";
  if (pathname.startsWith("/voice/agents/")) return "Agent builder";
  if (pathname === "/voice/receptionist") return "AI Receptionist";
  if (pathname === "/voice/agents") return "My Agents";
  if (pathname.startsWith("/voice/calls/")) return "Call detail";
  if (pathname.startsWith("/voice/")) return "AI Voice";
  if (pathname.startsWith("/phone/")) return "Business Phone";
  if (pathname.startsWith("/numbers/")) return "Number Detail";
  if (pathname.startsWith("/admin/customers/")) return "Customer Detail";
  return "Transovo SMS";
}
