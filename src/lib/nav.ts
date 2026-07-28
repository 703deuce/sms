import {
  LayoutDashboard,
  Send,
  Inbox,
  Users,
  Megaphone,
  Workflow,
  FileText,
  Sprout,
  BarChart3,
  Phone,
  ShieldCheck,
  Puzzle,
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
  { label: "Send", href: "/send", icon: Send, emphasize: true },
  { label: "Inbox", href: "/inbox", icon: Inbox, badge: 24 },
  {
    label: "Contacts",
    href: "/contacts",
    icon: Users,
    children: [
      { label: "All Contacts", href: "/contacts" },
      { label: "Lists", href: "/contacts/lists" },
      { label: "Segments", href: "/contacts/segments" },
      { label: "Tags", href: "/contacts/tags" },
      { label: "Imports", href: "/contacts/imports" },
      { label: "Unsubscribed", href: "/contacts/unsubscribed" },
      { label: "Blocked", href: "/contacts/blocked" },
    ],
  },
  {
    label: "Campaigns",
    href: "/campaigns",
    icon: Megaphone,
    children: [
      { label: "All Campaigns", href: "/campaigns" },
      { label: "Drafts", href: "/campaigns/drafts" },
      { label: "Scheduled", href: "/campaigns/scheduled" },
      { label: "Calendar", href: "/campaigns/calendar" },
      { label: "Completed", href: "/campaigns/completed" },
      { label: "Failed", href: "/campaigns/failed" },
      { label: "Recurring", href: "/campaigns/recurring" },
    ],
  },
  {
    label: "Automations",
    href: "/automations",
    icon: Workflow,
    children: [
      { label: "Flows", href: "/automations" },
      { label: "Templates", href: "/automations/templates" },
      { label: "Logs", href: "/automations/logs" },
    ],
  },
  { label: "Templates", href: "/templates", icon: FileText },
  {
    label: "Grow",
    href: "/grow/keywords",
    icon: Sprout,
    children: [
      { label: "Keywords", href: "/grow/keywords" },
      { label: "Forms", href: "/grow/forms" },
      { label: "QR Codes", href: "/grow/qr-codes" },
    ],
  },
  {
    label: "Reports",
    href: "/reports",
    icon: BarChart3,
    children: [
      { label: "Overview", href: "/reports" },
      { label: "Campaigns", href: "/reports/campaigns" },
      { label: "Messages", href: "/reports/messages" },
      { label: "Contacts", href: "/reports/contacts" },
      { label: "Inbox", href: "/reports/inbox" },
      { label: "Automations", href: "/reports/automations" },
      { label: "Usage", href: "/reports/usage" },
    ],
  },
  { label: "Phone Numbers", href: "/numbers", icon: Phone },
  { label: "Compliance", href: "/compliance", icon: ShieldCheck },
  { label: "Integrations", href: "/integrations", icon: Puzzle },
  { label: "Settings", href: "/settings/business", icon: Settings },
];

export const mobilePrimaryNav = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Inbox", href: "/inbox", icon: Inbox },
  { label: "Send", href: "/send", icon: Send },
  { label: "Contacts", href: "/contacts", icon: Users },
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
