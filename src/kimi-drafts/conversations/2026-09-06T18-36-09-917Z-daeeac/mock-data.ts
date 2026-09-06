import {
  Home,
  Users,
  Megaphone,
  Inbox,
  Workflow,
  BarChart3,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export interface NavChild {
  label: string;
  href: string;
}

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  badge?: number;
  children?: NavChild[];
}

export const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Home", icon: Home, href: "/" },
  {
    id: "audience",
    label: "Audience",
    icon: Users,
    href: "/audience",
    children: [
      { label: "Contacts", href: "/audience/contacts" },
      { label: "Lists", href: "/audience/lists" },
      { label: "Segments", href: "/audience/segments" },
    ],
  },
  { id: "campaigns", label: "Campaigns", icon: Megaphone, href: "/campaigns" },
  { id: "inbox", label: "Inbox", icon: Inbox, href: "/conversations", badge: 9 },
  { id: "automations", label: "Automations", icon: Workflow, href: "/automations" },
  { id: "analytics", label: "Analytics", icon: BarChart3, href: "/analytics" },
  {
    id: "tools",
    label: "Tools",
    icon: Wrench,
    href: "/tools",
    children: [
      { label: "Keywords", href: "/tools/keywords" },
      { label: "Integrations", href: "/tools/integrations" },
    ],
  },
];

export const MOCK_USER = {
  name: "John Doe",
  plan: "Transovo Tutorials",
  initials: "JD",
};

export const MOCK_CREDITS = {
  remaining: 7082,
  total: 10000,
};
