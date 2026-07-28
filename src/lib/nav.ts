import {
  LayoutDashboard,
  BarChart3,
  ShoppingBag,
  Users,
  CalendarDays,
  Workflow,
  Bot,
  Globe,
  Kanban,
  FileText,
  LineChart,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavChild = {
  label: string;
  href: string;
};

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: NavChild[];
  badge?: string | number;
  emphasize?: boolean;
};

export const appNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Stats", href: "/reports", icon: BarChart3 },
  { label: "Sales", href: "/campaigns", icon: ShoppingBag, badge: 12 },
  { label: "Contacts", href: "/contacts", icon: Users },
  { label: "Calendar", href: "/campaigns/calendar", icon: CalendarDays },
  { label: "Automation", href: "/automations", icon: Workflow },
  { label: "Chatbots", href: "/inbox", icon: Bot },
  {
    label: "Sites",
    href: "/grow/pages",
    icon: Globe,
    children: [
      { label: "Signup Pages", href: "/grow/pages" },
      { label: "Forms", href: "/grow/forms" },
      { label: "QR Codes", href: "/grow/qr-codes" },
    ],
  },
  { label: "Pipelines", href: "/campaigns/scheduled", icon: Kanban },
  {
    label: "Templates",
    href: "/templates",
    icon: FileText,
    children: [
      { label: "All Templates", href: "/templates" },
      { label: "Create Template", href: "/templates/new" },
      { label: "AI Generator", href: "/templates/ai" },
    ],
  },
  { label: "Analytics", href: "/reports/campaigns", icon: LineChart },
  { label: "Settings", href: "/settings/business", icon: Settings },
];

export const mobilePrimaryNav = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Inbox", href: "/inbox", icon: Bot },
  { label: "Send", href: "/send", icon: ShoppingBag },
  { label: "Contacts", href: "/contacts", icon: Users },
];

export const adminNav: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Customers", href: "/admin/customers", icon: Users },
  { label: "A2P Queue", href: "/admin/a2p", icon: Workflow },
  { label: "Monitoring", href: "/admin/monitoring", icon: BarChart3 },
  { label: "Numbers", href: "/admin/numbers", icon: FileText },
  { label: "Billing", href: "/admin/billing", icon: ShoppingBag },
  { label: "Support", href: "/admin/support", icon: Bot },
  { label: "System Logs", href: "/admin/logs", icon: Workflow },
  { label: "Platform Settings", href: "/admin/settings", icon: Settings },
];

export const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/getting-started": "Getting Started",
  "/send": "New Campaign",
  "/send/quick": "Quick Text",
  "/send/test": "Test Message",
  "/inbox": "Inbox",
  "/inbox/mine": "Assigned to Me",
  "/inbox/unassigned": "Unassigned",
  "/inbox/archived": "Archived",
  "/inbox/saved-replies": "Saved Replies",
  "/contacts": "All Contacts",
  "/contacts/lists": "Lists",
  "/contacts/segments": "Segments",
  "/contacts/tags": "Tags",
  "/contacts/imports": "Imports",
  "/contacts/fields": "Custom Fields",
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
  "/automations/logs": "Automation Logs",
  "/templates": "Templates",
  "/templates/new": "Create Template",
  "/templates/ai": "AI Template Generator",
  "/grow/keywords": "Keywords",
  "/grow/forms": "Opt-in Forms",
  "/grow/qr-codes": "QR Codes",
  "/grow/pages": "Signup Pages",
  "/grow/sources": "Subscriber Sources",
  "/reports": "Reports Overview",
  "/reports/campaigns": "Campaign Reports",
  "/reports/messages": "Message Reports",
  "/reports/contacts": "Contact Growth",
  "/reports/inbox": "Inbox Reports",
  "/reports/automations": "Automation Reports",
  "/reports/links": "Link Reports",
  "/reports/usage": "Usage & Cost",
  "/reports/audit-log": "Audit Log",
  "/numbers": "Phone Numbers",
  "/numbers/buy": "Buy Number",
  "/numbers/port": "Port Number",
  "/numbers/pools": "Sender Pools",
  "/compliance": "Compliance",
  "/compliance/business": "Business Profile",
  "/compliance/brand": "Brand Registration",
  "/compliance/campaign": "Campaign Registration",
  "/compliance/check": "Registration Readiness",
  "/compliance/consent": "Consent Records",
  "/compliance/suppression": "Suppression List",
  "/compliance/events": "Compliance Events",
  "/integrations": "Integrations",
  "/integrations/api": "API Keys",
  "/integrations/webhooks": "Webhooks",
  "/integrations/logs": "Developer Logs",
  "/settings/business": "Business Settings",
  "/settings/messaging": "Messaging Settings",
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
  if (pathname.startsWith("/campaigns/")) return "Campaign Detail";
  if (pathname.startsWith("/contacts/")) return "Contact Detail";
  if (pathname.startsWith("/automations/")) return "Automation Detail";
  if (pathname.startsWith("/numbers/")) return "Number Detail";
  if (pathname.startsWith("/admin/customers/")) return "Customer Detail";
  return "Transovo SMS";
}
